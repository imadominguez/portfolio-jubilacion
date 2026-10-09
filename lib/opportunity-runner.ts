import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { userTags } from "@/lib/cache-tags";
import { getPpmForUser, latestSnapshotForUser } from "@/lib/portfolio-data";
import { getHistorical, getNews } from "@/lib/yahoo-finance-client";
import { priceSignals, selectNews } from "@/lib/opportunity-signals";
import { mapLimit } from "@/lib/map-limit";
import {
  OpportunityAnalysisSchema,
  buildAnalysisInput,
  estimateCostUsd,
  modelRequestOptions,
  type Effort,
  type OpportunityReport,
  type PositionInput,
} from "@/lib/opportunity-report";

// Genera y guarda el reporte de oportunidades de un usuario (ADR-0018): la app
// junta precios (Yahoo) y titulares por acción, y Claude solo decide compra /
// mantener / venta. Lo usan el route POST /api/analyze-portfolio (botón en
// /portfolio, con sesión) y el cron mensual (sin sesión): por eso lee por userId.

// El timeout propio tiene que vencer antes que el maxDuration (300 s) del route.
export const TIMEOUT_CAP_MS = 290_000;
const DEFAULT_MODEL = "claude-sonnet-5-5";
// Pedidos a Yahoo en paralelo, sin saturar la API.
const YAHOO_CONCURRENCY = 4;
const HISTORY_DAYS = 370;

export type ReportResult =
  | { ok: true; report: OpportunityReport }
  | { ok: false; status: number; error: string };

function fechaHoy(): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

export async function generateOpportunityReport(
  userId: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<ReportResult> {
  try {
    const strategy = await db.investmentStrategy.findFirst({ where: { isActive: true } });
    if (!strategy) {
      return { ok: false, status: 500, error: "No hay estrategia activa configurada. Configurala en /strategy." };
    }

    const [snapshot, ppm, assets] = await Promise.all([
      latestSnapshotForUser(userId),
      getPpmForUser(userId),
      db.asset.findMany({ select: { ticker: true, underlyingTicker: true } }),
    ]);
    if (!snapshot || snapshot.positions.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "No hay snapshots importados. Importá tu tenencia desde Snapshots o el Dashboard.",
      };
    }

    const underlyingByTicker = new Map(assets.map((a) => [a.ticker, a.underlyingTicker]));
    const avgPriceByTicker = new Map(ppm.filter((p) => p.currency === "ARS").map((p) => [p.ticker, p.avgPrice]));
    const from = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

    // Precio y noticias por posición; una acción que falla no tumba el reporte.
    const gathered = await mapLimit(snapshot.positions, YAHOO_CONCURRENCY, async (pos) => {
      const underlying = underlyingByTicker.get(pos.ticker);
      if (!underlying) return { ticker: pos.ticker, input: null };
      try {
        const [history, news] = await Promise.all([getHistorical(underlying, from), getNews(underlying).catch(() => [])]);
        const signals = priceSignals(history);
        if (!signals) return { ticker: pos.ticker, input: null };
        const input: PositionInput = {
          ticker: pos.ticker,
          underlying,
          companyName: pos.instrumentName,
          priceArs: pos.price,
          avgPriceArs: avgPriceByTicker.get(pos.ticker) ?? null,
          signals,
          news: selectNews(news, underlying, { companyName: pos.instrumentName }),
        };
        return { ticker: pos.ticker, input };
      } catch {
        return { ticker: pos.ticker, input: null };
      }
    });

    const positions = gathered.flatMap((g) => (g.input ? [g.input] : []));
    const sinDatos = gathered.filter((g) => !g.input).map((g) => g.ticker);
    if (positions.length === 0) {
      return {
        ok: false,
        status: 502,
        error:
          "No se pudieron obtener precios para ninguna posición. Revisá que los assets tengan subyacente cargado o probá de nuevo en unos minutos.",
      };
    }

    const timeoutMs = options.timeoutMs ?? Number(process.env.ANTHROPIC_TIMEOUT_MS ?? TIMEOUT_CAP_MS);
    const effectiveTimeout =
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, TIMEOUT_CAP_MS) : TIMEOUT_CAP_MS;
    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    const effort = (process.env.ANTHROPIC_EFFORT ?? "low") as Effort;
    // Solo los parámetros que acepta el modelo elegido (un 400 si no).
    const opts = modelRequestOptions(model, effort);

    const client = new Anthropic({ timeout: effectiveTimeout, maxRetries: 1 });
    const response = await client.beta.messages.parse(
      {
        model,
        max_tokens: 16000,
        system: strategy.content,
        messages: [{ role: "user", content: buildAnalysisInput(positions, snapshot.snapshotDate) }],
        output_config: {
          format: betaZodOutputFormat(OpportunityAnalysisSchema),
          ...(opts.effort ? { effort: opts.effort } : {}),
        },
        ...(opts.thinking ? { thinking: opts.thinking } : {}),
        ...(opts.fallbacks ?? {}),
      },
      // Si el usuario cancela el análisis, se corta también la llamada a Claude.
      { signal: options.signal }
    );

    if (response.stop_reason === "refusal") {
      return { ok: false, status: 502, error: "Claude declinó generar el análisis. Probá de nuevo más tarde." };
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return {
        ok: false,
        status: 500,
        error:
          response.stop_reason === "max_tokens"
            ? "La respuesta se cortó por el límite de tokens. Probá con menos posiciones o un effort más bajo."
            : "La respuesta de Claude no tuvo el formato esperado.",
      };
    }

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    };
    const report: OpportunityReport = {
      version: 2,
      ...response.parsed_output,
      fecha_reporte: fechaHoy(),
      snapshot_fecha: snapshot.snapshotDate.toISOString().slice(0, 10),
      posiciones_sin_datos: sinDatos,
      uso: { model: response.model, ...usage, costUsd: estimateCostUsd(response.model, usage) },
    };

    try {
      await db.portfolioReport.create({
        data: {
          fechaReporte: report.fecha_reporte,
          rawText: JSON.stringify(response.parsed_output),
          normalizedJson: report as unknown as Parameters<typeof db.portfolioReport.create>[0]["data"]["normalizedJson"],
          userId,
        },
      });
      // Historial de señales y Plan DCA. Corre en route handlers (botón y cron),
      // donde updateTag no funciona.
      revalidateTag(userTags.reports(userId), "max");
    } catch (err) {
      // El reporte ya se generó (y se pagó): se devuelve aunque no se pueda guardar.
      console.error("No se pudo guardar el reporte en DB:", err);
    }

    return { ok: true, report };
  } catch (error) {
    if (error instanceof Anthropic.APIUserAbortError) {
      return { ok: false, status: 499, error: "Análisis cancelado por el usuario." };
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return {
        ok: false,
        status: 504,
        error: "El análisis superó el tiempo máximo configurado (ANTHROPIC_TIMEOUT_MS) y se canceló. Probá de nuevo.",
      };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, status: 429, error: "La API de Claude está limitando pedidos. Esperá un minuto y probá de nuevo." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", error.status, error.message);
      return { ok: false, status: 500, error: `Error al llamar a la API de Claude: ${error.message}` };
    }
    console.error("Error generando el reporte de oportunidades:", error);
    return { ok: false, status: 500, error: "Error interno del servidor." };
  }
}
