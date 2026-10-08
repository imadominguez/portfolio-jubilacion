import { describe, expect, it } from "vitest";
import {
  OpportunityAnalysisSchema,
  buildAnalysisInput,
  estimateCostUsd,
  isOpportunityReport,
  modelRequestOptions,
  type PositionInput,
} from "./opportunity-report";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const position: PositionInput = {
  ticker: "MSFT",
  underlying: "MSFT",
  companyName: "MICROSOFT CORP",
  priceArs: 22000,
  avgPriceArs: 20000,
  signals: {
    lastClose: 522.21,
    lastDate: day("2026-10-07"),
    change1mPct: -3.25,
    change3mPct: null,
    change1yPct: 18,
    high52w: 560,
    low52w: 400,
    fromHigh52wPct: -6.75,
    fromLow52wPct: 30.55,
  },
  news: [
    { title: "Microsoft turns Xbox into a media bet", publisher: "GuruFocus", publishedAt: day("2026-10-08"), relatedTickers: ["MSFT"] },
  ],
};

describe("buildAnalysisInput", () => {
  it("resume precio, variaciones, 52 semanas, precio promedio y noticias por posición", () => {
    const text = buildAnalysisInput([position], day("2026-10-02"));
    expect(text).toContain("snapshot del 2026-10-02");
    expect(text).toContain("## MSFT (subyacente MSFT, MICROSOFT CORP)");
    expect(text).toContain("Precio USD 522.21 al 2026-10-07 | 1m -3.3% | 3m s/d | 1a +18.0%");
    expect(text).toContain("máx 560.00 (-6.8%), mín 400.00 (+30.6%)");
    expect(text).toContain("CEDEAR vs mi precio promedio de compra (ARS): +10.0%");
    expect(text).toContain("- 2026-10-08 GuruFocus: Microsoft turns Xbox into a media bet");
  });

  it("indica cuando no hay noticias ni precio promedio", () => {
    const text = buildAnalysisInput([{ ...position, news: [], avgPriceArs: null }], day("2026-10-02"));
    expect(text).toContain("Noticias: sin titulares recientes.");
    expect(text).toContain("precio promedio de compra (ARS): s/d");
  });
});

describe("estimateCostUsd", () => {
  const usage = { inputTokens: 8000, outputTokens: 4000, cacheCreationTokens: 0, cacheReadTokens: 0 };

  it("usa los precios del modelo que respondió", () => {
    expect(estimateCostUsd("claude-sonnet-5-5", usage)).toBeCloseTo(0.056);
    expect(estimateCostUsd("claude-haiku-4-5", usage)).toBeCloseTo(0.028);
  });

  it("reconoce ids con sufijo sin confundir modelos con prefijo común", () => {
    expect(estimateCostUsd("claude-sonnet-5-5-20261001", usage)).toBeCloseTo(0.056);
    expect(estimateCostUsd("claude-sonnet-5", usage)).toBeCloseTo(0.056);
  });

  it("devuelve null para un modelo sin precio conocido", () => {
    expect(estimateCostUsd("claude-desconocido-9", usage)).toBeNull();
  });
});

describe("OpportunityAnalysisSchema / isOpportunityReport", () => {
  it("valida una respuesta bien formada y rechaza señales fuera del enum", () => {
    const ok = {
      resumen: "Mes tranquilo.",
      acciones: [{ ticker: "KO", senal: "compra", confianza: "media", precio: "Cayó 8%.", noticias: "Sin novedades.", motivo: "Caída sin deterioro.", riesgos: "Guía débil." }],
    };
    expect(OpportunityAnalysisSchema.safeParse(ok).success).toBe(true);
    const bad = { ...ok, acciones: [{ ...ok.acciones[0], senal: "comprar" }] };
    expect(OpportunityAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  it("distingue los reportes nuevos de los de asignaciones", () => {
    expect(isOpportunityReport({ version: 2 })).toBe(true);
    expect(isOpportunityReport({ fecha_reporte: "2026-09-01", posiciones: [] })).toBe(false);
    expect(isOpportunityReport(null)).toBe(false);
  });
});

describe("modelRequestOptions", () => {
  it("Sonnet 5.5: thinking adaptativo, effort y fallbacks", () => {
    const o = modelRequestOptions("claude-sonnet-5-5", "low");
    expect(o.thinking).toEqual({ type: "adaptive" });
    expect(o.effort).toBe("low");
    expect(o.fallbacks).toEqual({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  });

  it("Sonnet 5: effort y thinking, pero sin fallbacks", () => {
    const o = modelRequestOptions("claude-sonnet-5", "low");
    expect(o.effort).toBe("low");
    expect(o.thinking).toEqual({ type: "adaptive" });
    expect(o.fallbacks).toBeUndefined();
  });

  it("Haiku 4.5: ninguno de los tres", () => {
    expect(modelRequestOptions("claude-haiku-4-5", "low")).toEqual({
      thinking: undefined,
      effort: undefined,
      fallbacks: undefined,
    });
  });

  it("acepta un sufijo de fecha pero no confunde modelos con prefijo común", () => {
    expect(modelRequestOptions("claude-opus-5-5-20261001", "medium").fallbacks).toBeDefined();
    expect(modelRequestOptions("claude-sonnet-5-20260601", "low").fallbacks).toBeUndefined();
    expect(modelRequestOptions("claude-sonnet-5-9", "low").effort).toBeUndefined();
  });
});
