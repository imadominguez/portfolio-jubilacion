import { describe, expect, it } from "vitest";
import { priceSignals, selectNews, type NewsItem } from "./opportunity-signals";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("priceSignals", () => {
  const history = [
    { date: day("2025-10-01"), close: 100 },
    { date: day("2026-01-05"), close: 150 },
    { date: day("2026-07-01"), close: 80 },
    { date: day("2026-09-01"), close: 120 },
    { date: day("2026-10-01"), close: 110 },
  ];

  it("calcula variaciones contra el cierre en o antes de cada fecha", () => {
    const s = priceSignals(history)!;
    expect(s.lastClose).toBe(110);
    expect(s.change1mPct).toBeCloseTo(((110 - 120) / 120) * 100);
    expect(s.change3mPct).toBeCloseTo(((110 - 80) / 80) * 100);
    expect(s.change1yPct).toBeCloseTo(10);
  });

  it("mide la distancia al máximo y al mínimo de 52 semanas", () => {
    const s = priceSignals(history)!;
    expect(s.high52w).toBe(150);
    expect(s.low52w).toBe(80);
    expect(s.fromHigh52wPct).toBeCloseTo(((110 - 150) / 150) * 100);
    expect(s.fromLow52wPct).toBeCloseTo(((110 - 80) / 80) * 100);
  });

  it("devuelve null en las variaciones sin historia suficiente y null sin datos", () => {
    const s = priceSignals([
      { date: day("2026-09-20"), close: 50 },
      { date: day("2026-10-01"), close: 55 },
    ])!;
    expect(s.change1mPct).toBeNull();
    expect(s.change1yPct).toBeNull();
    expect(priceSignals([])).toBeNull();
    expect(priceSignals([{ date: day("2026-10-01"), close: 0 }])).toBeNull();
  });
});

describe("selectNews", () => {
  const now = day("2026-10-08");
  const news = (title: string, related: string[], iso = "2026-10-07"): NewsItem => ({
    title,
    publisher: "Medio",
    publishedAt: day(iso),
    relatedTickers: related,
  });

  it("descarta notas de otras empresas que solo mencionan al ticker de pasada", () => {
    const items = [
      news("Grab Holdings Faces Earnings Pressure", ["GRAB", "NVDA", "MELI"]),
      news("MercadoLibre expands credit in Brazil", ["MELI"]),
    ];
    const out = selectNews(items, "MELI", { now });
    expect(out.map((n) => n.title)).toEqual(["MercadoLibre expands credit in Brazil"]);
  });

  it("acepta notas que nombran el ticker o la empresa en el título", () => {
    const items = [
      news("Why MSFT stock is rising", ["AAPL", "MSFT"]),
      news("Microsoft turns Xbox franchises into a media bet", ["AAPL", "MSFT"]),
      news("Securitize soars on onchain stocks", ["AAPL", "NVDA", "MSFT"]),
    ];
    const out = selectNews(items, "MSFT", { now, companyName: "CEDEAR MICROSOFT CORP" });
    expect(out).toHaveLength(2);
  });

  it("ordena por fecha, descarta viejas y duplicadas y respeta el máximo", () => {
    const items = [
      news("KO earnings beat", ["KO"], "2026-10-01"),
      news("KO raises dividend", ["KO"], "2026-10-06"),
      news("KO raises dividend", ["KO"], "2026-10-06"),
      news("KO old news", ["KO"], "2026-07-01"),
      news("KO new bottling deal", ["KO"], "2026-10-05"),
    ];
    const out = selectNews(items, "KO", { now, max: 2 });
    expect(out.map((n) => n.title)).toEqual(["KO raises dividend", "KO new bottling deal"]);
  });
});
