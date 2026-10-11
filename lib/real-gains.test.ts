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
      [trade({ ticker: "AAA", date: d("2024-03-01"), quantity: 10, price: 4, currency: "USD", fee: 0.5, movementGross: -40 })],
      lookups({ cclNear: () => ({ value: 1200, exact: true }) })
    );
    const aaa = res.get("AAA")!;
    expect(aaa.costUsdCcl).toBeCloseTo(40.5);
    expect(aaa.costArs).toBeCloseTo(40.5 * 1200);
  });

  it("una venta descarga los tres costos a costo promedio", () => {
    const res = costBasisByTicker(
      [
        trade({ ticker: "BBB", date: d("2025-01-10"), quantity: 4, price: 1000 }),
        trade({ ticker: "BBB", date: d("2025-03-10"), quantity: -2, price: 3000, type: "SELL" }),
      ],
      lookups()
    );
    const bbb = res.get("BBB")!;
    expect(bbb.totalQty).toBe(2);
    expect(bbb.costArs).toBe(2000);
    expect(bbb.costUsdCcl).toBe(2);
    expect(bbb.costUsdStock).toBe(20); // 2 / 10 × 100
  });

  it("omite el ticker si una compra en USD no tiene CCL", () => {
    const res = costBasisByTicker(
      [
        trade({ ticker: "CCC", date: d("2019-01-01"), quantity: 1, price: 30, currency: "USD" }),
        trade({ ticker: "DDD", date: d("2025-01-01"), quantity: 2, price: 100 }),
      ],
      lookups({ cclNear: () => null })
    );
    expect([...res.keys()]).toEqual(["DDD"]);
    expect(res.get("DDD")!.costUsdCcl).toBeNull();
    expect(res.get("DDD")!.cclMisses).toBe(1);
  });

  it("sin precio del subyacente el método B queda sin dato", () => {
    const res = costBasisByTicker(
      [trade({ ticker: "DDD", date: d("2025-01-01"), quantity: 2, price: 100 })],
      lookups({ stockPriceNear: () => null })
    );
    expect(res.get("DDD")!.costUsdStock).toBeNull();
    expect(res.get("DDD")!.stockPriceAvailable).toBe(false);
  });
});
