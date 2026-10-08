// Reporte de oportunidades (ADR-0018): esquema de salida, armado de la entrada
// compacta para Claude y costo por modelo. Puro, sin Prisma.

import { z } from "zod";
import type { NewsItem, PriceSignals } from "@/lib/opportunity-signals";

// ─── Esquema de salida ────────────────────────────────────────────────────────
// Se le pasa a la API como structured output: la respuesta siempre valida
// contra este esquema, así que no hace falta normalizar el JSON.

export const SENALES = ["compra", "mantener", "venta"] as const;
export const CONFIANZAS = ["alta", "media", "baja"] as const;

export const OpportunityAnalysisSchema = z.object({
  resumen: z.string().describe("2-4 oraciones con lo más importante del mes."),
  acciones: z.array(
    z.object({
      ticker: z.string(),
      senal: z.enum(SENALES),
      confianza: z.enum(CONFIANZAS),
      precio: z.string().describe("Lectura del comportamiento del precio, 1-2 oraciones."),
      noticias: z.string().describe("Lectura de las noticias, 1-2 oraciones; si no hay, decirlo."),
      motivo: z.string().describe("Por qué la señal, 1-2 oraciones."),
      riesgos: z.string().describe("Qué invalidaría la señal, 1 oración."),
    })
  ),
});

export type OpportunityAnalysis = z.infer<typeof OpportunityAnalysisSchema>;

export type ReportUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number | null;
};

// Lo que se guarda en PortfolioReport.normalizedJson. `version: 2` lo distingue
// de los reportes de asignaciones anteriores, que siguen visibles en el historial.
export type OpportunityReport = OpportunityAnalysis & {
  version: 2;
  fecha_reporte: string;
  snapshot_fecha: string;
  posiciones_sin_datos: string[];
  uso: ReportUsage;
};

export function isOpportunityReport(value: unknown): value is OpportunityReport {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 2;
}

// ─── Entrada para Claude ──────────────────────────────────────────────────────

export type PositionInput = {
  ticker: string;
  underlying: string;
  companyName: string | null;
  // Precio del CEDEAR en ARS en el snapshot y precio promedio de compra en ARS.
  priceArs: number;
  avgPriceArs: number | null;
  signals: PriceSignals;
  news: NewsItem[];
};

const fmtPct = (v: number | null) => (v === null ? "s/d" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

// Texto compacto (una sección corta por posición): es todo lo que Claude lee,
// así que acá se define la mayor parte del costo de entrada.
export function buildAnalysisInput(positions: PositionInput[], snapshotDate: Date): string {
  const blocks = positions.map((p) => {
    const s = p.signals;
    const vsAvg =
      p.avgPriceArs && p.avgPriceArs > 0
        ? fmtPct(((p.priceArs - p.avgPriceArs) / p.avgPriceArs) * 100)
        : "s/d";
    const lines = [
      `## ${p.ticker} (subyacente ${p.underlying}${p.companyName ? `, ${p.companyName}` : ""})`,
      `Precio USD ${s.lastClose.toFixed(2)} al ${fmtDate(s.lastDate)} | 1m ${fmtPct(s.change1mPct)} | 3m ${fmtPct(s.change3mPct)} | 1a ${fmtPct(s.change1yPct)}`,
      `52 semanas: máx ${s.high52w.toFixed(2)} (${fmtPct(s.fromHigh52wPct)}), mín ${s.low52w.toFixed(2)} (${fmtPct(s.fromLow52wPct)})`,
      `CEDEAR vs mi precio promedio de compra (ARS): ${vsAvg}`,
    ];
    if (p.news.length === 0) {
      lines.push("Noticias: sin titulares recientes.");
    } else {
      lines.push("Noticias:");
      for (const n of p.news) lines.push(`- ${fmtDate(n.publishedAt)} ${n.publisher}: ${n.title}`);
    }
    return lines.join("\n");
  });

  return [
    `Tenencia según el snapshot del ${fmtDate(snapshotDate)}. Analizá cada posición y devolvé una señal por ticker.`,
    "",
    ...blocks,
  ].join("\n\n");
}

// ─── Costo ────────────────────────────────────────────────────────────────────
// USD por millón de tokens (precios de la API de Anthropic). Si el modelo no está
// en la tabla, el costo queda en null en lugar de informar uno equivocado.

type Pricing = { input: number; output: number; cacheWrite: number; cacheRead: number };

export const MODEL_PRICING: Record<string, Pricing> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

function pricingFor(model: string): Pricing | null {
  // La API puede devolver el id con sufijo; gana la clave más larga que coincide.
  const key = Object.keys(MODEL_PRICING)
    .filter((k) => model === k || model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? MODEL_PRICING[key] : null;
}

export function estimateCostUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number }
): number | null {
  const p = pricingFor(model);
  if (!p) return null;
  return (
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheCreationTokens * p.cacheWrite +
      usage.cacheReadTokens * p.cacheRead) /
    1_000_000
  );
}
