import { describe, expect, it } from "vitest";
import { resultYears, tickerResults, type ResultsSnapshot, type ResultsTrade } from "@/lib/ticker-results";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const trade = (over: Partial<ResultsTrade> & Pick<ResultsTrade, "date" | "type" | "quantity" | "price">): ResultsTrade => ({
  ticker: "AAA",
  currency: "ARS",
  fee: 0,
  amount: null,
  ...over,
});

const snap = (date: string, ccl: number, positions: ResultsSnapshot["positions"]): ResultsSnapshot => ({
  date: d(date),
  ccl,
  positions,
});

// CCL fijo por tramo: 1000 en 2025, 1200 en 2026.
const cclAt = (date: Date) => (date.getUTCFullYear() < 2026 ? 1000 : 1200);

describe("tickerResults", () => {
  it("descuenta las compras del período y abre realizado y no realizado", () => {
    const trades = [
      trade({ date: d("2025-06-01"), type: "BUY", quantity: 10, price: 1000 }),
      trade({ date: d("2026-03-01"), type: "BUY", quantity: 10, price: 1200 }),
      trade({ date: d("2026-05-01"), type: "SELL", quantity: -5, price: 1500 }),
    ];
    const snapshots = [
      snap("2025-12-31", 1000, [{ ticker: "AAA", quantity: 10, currency: "ARS", value: 11_000 }]),
      snap("2026-10-31", 1200, [{ ticker: "AAA", quantity: 15, currency: "ARS", value: 24_000 }]),
    ];

    const r = tickerResults({ year: 2026, trades, snapshots, dividends: [], cclAt, changes: [] })!;
    const aaa = r.tickers[0];

    // 24.000 − 11.000 − 12.000 + 7.500
    expect(aaa.total.ars).toBeCloseTo(8_500);
    // Costo promedio 1.100 por unidad (10 a 1.000 + 10 a 1.200): 7.500 − 5.500
    expect(aaa.realized.ars).toBeCloseTo(2_000);
    expect(aaa.unrealized.ars).toBeCloseTo(6_500);
    // En USD: 20 − 11 − 10 + 6,25
    expect(aaa.total.usd).toBeCloseTo(5.25);
    expect(aaa.quantityMismatch).toBeNull();
    expect(aaa.events).toHaveLength(2);
    expect(aaa.events[1].positionAfter).toBe(15);
    expect(r.monthly.map((m) => m.month)).toEqual(["2026-03", "2026-05"]);
  });

  it("suma los dividendos al resultado y no al no realizado", () => {
    const trades = [trade({ date: d("2025-06-01"), type: "BUY", quantity: 10, price: 1000 })];
    const snapshots = [
      snap("2025-12-31", 1000, [{ ticker: "AAA", quantity: 10, currency: "ARS", value: 10_000 }]),
      snap("2026-06-30", 1200, [{ ticker: "AAA", quantity: 10, currency: "ARS", value: 12_000 }]),
    ];
    const r = tickerResults({
      year: 2026,
      trades,
      snapshots,
      dividends: [{ date: d("2026-04-01"), ticker: "AAA", currency: "USD", amount: 1 }],
      cclAt,
      changes: [],
    })!;
    const aaa = r.tickers[0];
    expect(aaa.dividends).toEqual({ ars: 1_200, usd: 1 });
    expect(aaa.total.ars).toBeCloseTo(3_200);
    expect(aaa.unrealized.ars).toBeCloseTo(2_000);
    // En USD la tenencia no cambió de valor (10 → 10): solo el dividendo.
    expect(aaa.total.usd).toBeCloseTo(1);
  });

  it("avisa si la tenencia final no cierra con las operaciones", () => {
    const trades = [trade({ date: d("2026-02-01"), type: "BUY", quantity: 10, price: 1000 })];
    const snapshots = [snap("2026-06-30", 1200, [{ ticker: "AAA", quantity: 12, currency: "ARS", value: 13_000 }])];
    const aaa = tickerResults({ year: 2026, trades, snapshots, dividends: [], cclAt, changes: [] })!.tickers[0];
    expect(aaa.quantityMismatch).toEqual({ expected: 10, actual: 12 });
  });

  it("marca la tenencia previa sin snapshot que la valúe", () => {
    const trades = [trade({ date: d("2025-02-01"), type: "BUY", quantity: 10, price: 1000 })];
    const snapshots = [snap("2026-06-30", 1200, [{ ticker: "AAA", quantity: 10, currency: "ARS", value: 13_000 }])];
    const r = tickerResults({ year: 2026, trades, snapshots, dividends: [], cclAt, changes: [] })!;
    expect(r.start).toBeNull();
    expect(r.tickers[0].unvaluedStart).toBe(true);
  });

  it("expresa la tenencia inicial en CEDEARs del ratio actual tras un split", () => {
    const trades = [trade({ date: d("2025-06-01"), type: "BUY", quantity: 10, price: 1000 })];
    const snapshots = [
      snap("2025-12-31", 1000, [{ ticker: "AAA", quantity: 10, currency: "ARS", value: 10_000 }]),
      snap("2026-06-30", 1200, [{ ticker: "AAA", quantity: 20, currency: "ARS", value: 12_000 }]),
    ];
    const changes = [{ ticker: "AAA", effectiveDate: d("2026-03-01"), oldRatio: 10, newRatio: 20 }];
    const aaa = tickerResults({ year: 2026, trades, snapshots, dividends: [], cclAt, changes })!.tickers[0];
    expect(aaa.startQuantity).toBe(20);
    expect(aaa.quantityMismatch).toBeNull();
    expect(aaa.total.ars).toBeCloseTo(2_000);
  });

  it("deja fuera las operaciones posteriores al último snapshot y las cuenta", () => {
    const trades = [
      trade({ date: d("2026-02-01"), type: "BUY", quantity: 10, price: 1000 }),
      trade({ date: d("2026-11-05"), type: "BUY", quantity: 5, price: 1000 }),
    ];
    const snapshots = [snap("2026-10-31", 1200, [{ ticker: "AAA", quantity: 10, currency: "ARS", value: 11_000 }])];
    const r = tickerResults({ year: 2026, trades, snapshots, dividends: [], cclAt, changes: [] })!;
    expect(r.tradesAfterEnd).toBe(1);
    expect(r.tickers[0].boughtQuantity).toBe(10);
  });

  it("cuenta las operaciones por fecha de liquidación: el snapshot muestra lo liquidado", () => {
    const trades = [
      trade({ date: d("2026-02-01"), type: "BUY", quantity: 10, price: 1000 }),
      // Operada antes del snapshot, liquida después: Cocos todavía no la muestra.
      trade({ date: d("2026-11-06"), settlementDate: d("2026-11-12"), type: "BUY", quantity: 2, price: 1000 }),
    ];
    const snapshots = [snap("2026-11-10", 1200, [{ ticker: "AAA", quantity: 10, currency: "ARS", value: 11_000 }])];
    const r = tickerResults({ year: 2026, trades, snapshots, dividends: [], cclAt, changes: [] })!;
    expect(r.tickers[0].quantityMismatch).toBeNull();
    expect(r.tickers[0].boughtQuantity).toBe(10);
    expect(r.tradesAfterEnd).toBe(1);
  });

  it("ignora instrumentos sin operaciones (FCI, saldos)", () => {
    const snapshots = [snap("2026-06-30", 1200, [{ ticker: "FCI", quantity: 100, currency: "ARS", value: 100 }])];
    const r = tickerResults({ year: 2026, trades: [], snapshots, dividends: [], cclAt, changes: [] })!;
    expect(r.tickers).toHaveLength(0);
  });

  it("devuelve null para un año sin snapshot", () => {
    expect(tickerResults({ year: 2024, trades: [], snapshots: [], dividends: [], cclAt, changes: [] })).toBeNull();
  });
});

describe("resultYears", () => {
  it("lista los años con snapshot, del más reciente al más viejo", () => {
    expect(resultYears([{ date: d("2025-03-01") }, { date: d("2026-01-01") }, { date: d("2025-12-31") }])).toEqual([
      2026, 2025,
    ]);
  });
});
