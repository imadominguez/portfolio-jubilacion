import { describe, expect, it } from "vitest";
import { costBasisByTicker, type CostLookups, type CostTrade } from "./real-gains";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const trade = (t: Partial<CostTrade> & Pick<CostTrade, "ticker" | "date" | "quantity" | "price">): CostTrade => ({
  type: "BUY",
  currency: "ARS",
  fee: null,
  movementGross: null,
  ...t,
});
const lookups = (over: Partial<CostLookups> = {}): CostLookups => ({
  cclNear: () => ({ value: 1000, exact: true }),
  stockPriceNear: () => 100,
  cedearRatio: () => 10,
  ...over,
});

describe("costBasisByTicker", () => {
  it("una compra en dólares cuesta lo pagado en USD y eso × CCL en pesos", () => {
    const res = costBasisByTicker(
      [trade({ ticker: "NVDA", date: d("2024-10-01"), quantity: 11, price: 5, currency: "USD", fee: 0.22, movementGross: -55 })],
      lookups({ cclNear: () => ({ value: 1245.8, exact: true }) })
    );
    const nvda = res.get("NVDA")!;
    expect(nvda.costUsdCcl).toBeCloseTo(55.22);
    expect(nvda.costArs).toBeCloseTo(55.22 * 1245.8);
  });

  it("una venta descarga los tres costos a costo promedio", () => {
    const res = costBasisByTicker(
      [
        trade({ ticker: "AMD", date: d("2025-04-08"), quantity: 6, price: 12000 }),
        trade({ ticker: "AMD", date: d("2026-05-04"), quantity: -3, price: 52000, type: "SELL" }),
      ],
      lookups()
    );
    const amd = res.get("AMD")!;
    expect(amd.totalQty).toBe(3);
    expect(amd.costArs).toBe(36000);
    expect(amd.costUsdCcl).toBe(36);
    expect(amd.costUsdStock).toBe(30); // 3 / 10 × 100
  });

  it("omite el ticker si una compra en USD no tiene CCL", () => {
    const res = costBasisByTicker(
      [
        trade({ ticker: "SPY", date: d("2019-01-01"), quantity: 1, price: 30, currency: "USD" }),
        trade({ ticker: "KO", date: d("2025-01-01"), quantity: 2, price: 100 }),
      ],
      lookups({ cclNear: () => null })
    );
    expect([...res.keys()]).toEqual(["KO"]);
    expect(res.get("KO")!.costUsdCcl).toBeNull();
    expect(res.get("KO")!.cclMisses).toBe(1);
  });

  it("sin precio del subyacente el método B queda sin dato", () => {
    const res = costBasisByTicker(
      [trade({ ticker: "KO", date: d("2025-01-01"), quantity: 2, price: 100 })],
      lookups({ stockPriceNear: () => null })
    );
    expect(res.get("KO")!.costUsdStock).toBeNull();
    expect(res.get("KO")!.stockPriceAvailable).toBe(false);
  });
});
