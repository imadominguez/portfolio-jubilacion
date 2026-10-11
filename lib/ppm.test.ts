import { describe, expect, it } from "vitest";
import { computePpm, type PpmTrade } from "./ppm";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const trade = (t: Partial<PpmTrade> & Pick<PpmTrade, "ticker" | "date" | "quantity" | "price">): PpmTrade => ({
  type: "BUY",
  currency: "ARS",
  fee: null,
  movementGross: null,
  ...t,
});
const fixedCcl = (ccl: number) => () => ccl;

describe("computePpm", () => {
  it("pasa una compra en dólares al CCL de su fecha", () => {
    const rows = computePpm(
      [trade({ ticker: "NVDA", date: d("2024-10-01"), quantity: 11, price: 5.0155, currency: "USD", fee: 0.22, movementGross: -55.17 })],
      fixedCcl(1245.8)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].totalCost).toBeCloseTo(55.39 * 1245.8);
    expect(rows[0].avgPrice).toBeCloseTo((55.39 * 1245.8) / 11);
  });

  it("promedia compras en USD y en ARS en pesos, cada una con su CCL", () => {
    const ccl = (date: Date) => (date < d("2025-01-01") ? 1200 : 1500);
    const rows = computePpm(
      [
        trade({ ticker: "AAPL", date: d("2024-09-23"), quantity: 5, price: 10, currency: "USD" }),
        trade({ ticker: "AAPL", date: d("2025-04-08"), quantity: 5, price: 15000 }),
      ],
      ccl
    );
    expect(rows[0].totalCost).toBe(50 * 1200 + 75000);
    expect(rows[0].avgPrice).toBe(13500);
  });

  it("una venta descarga costo al PPM vigente y no lo cambia", () => {
    const rows = computePpm(
      [
        trade({ ticker: "AMD", date: d("2025-04-08"), quantity: 6, price: 12000 }),
        trade({ ticker: "AMD", date: d("2026-05-04"), quantity: -3, price: 52000, type: "SELL" }),
        trade({ ticker: "AMD", date: d("2026-06-01"), quantity: 3, price: 20000 }),
      ],
      fixedCcl(1500)
    );
    expect(rows[0].totalQuantity).toBe(6);
    expect(rows[0].avgPrice).toBe(16000);
  });

  it("el mismo día procesa la compra antes que la venta", () => {
    const rows = computePpm(
      [
        trade({ ticker: "T661O", date: d("2026-07-20"), quantity: 5132, price: 0.068, currency: "USD", type: "SELL" }),
        trade({ ticker: "T661O", date: d("2026-07-20"), quantity: 5132, price: 103.95 }),
      ],
      fixedCcl(1500)
    );
    expect(rows).toEqual([]);
  });

  it("omite tickers sin tenencia y los que tienen una compra en USD sin CCL", () => {
    const rows = computePpm(
      [
        trade({ ticker: "SPY", date: d("2019-01-01"), quantity: 1, price: 30, currency: "USD" }),
        trade({ ticker: "KO", date: d("2025-01-01"), quantity: 2, price: 100 }),
        trade({ ticker: "KO", date: d("2025-02-01"), quantity: 2, price: 120, type: "SELL" }),
        trade({ ticker: "WMT", date: d("2025-01-01"), quantity: 1, price: 100 }),
      ],
      () => null
    );
    expect(rows.map((r) => r.ticker)).toEqual(["WMT"]);
  });
});
