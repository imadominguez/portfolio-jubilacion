import { describe, expect, it } from "vitest";
import { tradeGrossAmount } from "./trade-amount";

describe("tradeGrossAmount", () => {
  it("usa el bruto de Cocos: en bonos el precio es cada 100 nominales", () => {
    expect(tradeGrossAmount({ quantity: 5132, price: 103.95, movementGross: -5334.714 })).toBeCloseTo(5334.714);
  });

  it("sin movimiento usa cantidad × precio, aunque la cantidad venga negativa", () => {
    expect(tradeGrossAmount({ quantity: -3, price: 52125 })).toBe(156375);
  });
});
