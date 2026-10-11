import { describe, expect, it } from "vitest";
import { tradeGrossAmount } from "./trade-amount";

describe("tradeGrossAmount", () => {
  it("usa el bruto de Cocos: en bonos el precio es cada 100 nominales", () => {
    expect(tradeGrossAmount({ quantity: 1000, price: 100, movementGross: -1000 })).toBeCloseTo(1000);
  });

  it("sin movimiento usa cantidad × precio, aunque la cantidad venga negativa", () => {
    expect(tradeGrossAmount({ quantity: -3, price: 3000 })).toBe(9000);
  });
});
