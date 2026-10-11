import { describe, expect, it } from "vitest";
import { adjustForRatioChanges, ratioFactor, type RatioChange } from "./ratio-changes";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const split: RatioChange = { ticker: "AAA", effectiveDate: d("2026-06-01"), oldRatio: 20, newRatio: 60 };

describe("ratioFactor", () => {
  it("multiplica solo las operaciones anteriores al cambio del mismo ticker", () => {
    expect(ratioFactor([split], "AAA", d("2025-01-15"))).toBe(3);
    expect(ratioFactor([split], "AAA", d("2026-06-01"))).toBe(1);
    expect(ratioFactor([split], "BBB", d("2025-01-15"))).toBe(1);
  });

  it("encadena varios cambios", () => {
    const changes = [split, { ...split, effectiveDate: d("2027-01-04"), oldRatio: 60, newRatio: 120 }];
    expect(ratioFactor(changes, "AAA", d("2025-01-01"))).toBe(6);
    expect(ratioFactor(changes, "AAA", d("2026-07-01"))).toBe(2);
  });
});

describe("adjustForRatioChanges", () => {
  it("pasa la operación a CEDEARs del ratio actual sin cambiar el monto", () => {
    const trade = { ticker: "AAA", date: d("2025-01-15"), quantity: 2, price: 30000, fee: 150 };
    const adjusted = adjustForRatioChanges(trade, [split]);
    expect(adjusted.quantity).toBe(6);
    expect(adjusted.price).toBe(10000);
    expect(adjusted.quantity * adjusted.price).toBe(60000);
    expect(adjusted.fee).toBe(150);
  });

  it("devuelve la misma operación si no hay cambio que la afecte", () => {
    const trade = { ticker: "AAA", date: d("2026-07-01"), quantity: 2, price: 20000 };
    expect(adjustForRatioChanges(trade, [split])).toBe(trade);
  });
});
