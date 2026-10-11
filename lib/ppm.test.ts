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
      [trade({ ticker: "AAA", date: d("2024-03-01"), quantity: 10, price: 4, currency: "USD", fee: 0.5, movementGross: -40 })],
      fixedCcl(1000)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].totalCost).toBeCloseTo(40.5 * 1000);
    expect(rows[0].avgPrice).toBeCloseTo((40.5 * 1000) / 10);
  });

  it("promedia compras en USD y en ARS en pesos, cada una con su CCL", () => {
    const ccl = (date: Date) => (date < d("2025-01-01") ? 1200 : 1500);
    const rows = computePpm(
      [
        trade({ ticker: "BBB", date: d("2024-06-01"), quantity: 5, price: 10, currency: "USD" }),
        trade({ ticker: "BBB", date: d("2025-06-01"), quantity: 5, price: 15000 }),
      ],
      ccl
    );
    expect(rows[0].totalCost).toBe(50 * 1200 + 75000);
    expect(rows[0].avgPrice).toBe(13500);
  });

  it("una venta descarga costo al PPM vigente y no lo cambia", () => {
    const rows = computePpm(
      [
        trade({ ticker: "CCC", date: d("2025-01-10"), quantity: 4, price: 1000 }),
        trade({ ticker: "CCC", date: d("2025-03-10"), quantity: -2, price: 3000, type: "SELL" }),
        trade({ ticker: "CCC", date: d("2025-05-10"), quantity: 2, price: 2000 }),
      ],
      fixedCcl(1500)
    );
    expect(rows[0].totalQuantity).toBe(4);
    expect(rows[0].avgPrice).toBe(1500);
  });

  it("el mismo día procesa la compra antes que la venta", () => {
    const rows = computePpm(
      [
        trade({ ticker: "ON1", date: d("2025-07-01"), quantity: 1000, price: 0.07, currency: "USD", type: "SELL" }),
        trade({ ticker: "ON1", date: d("2025-07-01"), quantity: 1000, price: 100 }),
      ],
      fixedCcl(1500)
    );
    expect(rows).toEqual([]);
  });

  it("omite tickers sin tenencia y los que tienen una compra en USD sin CCL", () => {
    const rows = computePpm(
      [
        trade({ ticker: "DDD", date: d("2019-01-01"), quantity: 1, price: 30, currency: "USD" }),
        trade({ ticker: "EEE", date: d("2025-01-01"), quantity: 2, price: 100 }),
        trade({ ticker: "EEE", date: d("2025-02-01"), quantity: 2, price: 120, type: "SELL" }),
        trade({ ticker: "FFF", date: d("2025-01-01"), quantity: 1, price: 100 }),
      ],
      () => null
    );
    expect(rows.map((r) => r.ticker)).toEqual(["FFF"]);
  });
});
