import { describe, expect, it } from "vitest";
import { adjustForRatioChanges, ratioFactor, type RatioChange } from "./ratio-changes";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const spy: RatioChange = { ticker: "SPY", effectiveDate: d("2026-06-01"), oldRatio: 20, newRatio: 60 };

describe("ratioFactor", () => {
  it("multiplica solo las operaciones anteriores al cambio del mismo ticker", () => {
    expect(ratioFactor([spy], "SPY", d("2025-10-06"))).toBe(3);
    expect(ratioFactor([spy], "SPY", d("2026-06-01"))).toBe(1);
    expect(ratioFactor([spy], "AAPL", d("2025-10-06"))).toBe(1);
  });

  it("encadena varios cambios", () => {
    const changes = [spy, { ...spy, effectiveDate: d("2027-01-04"), oldRatio: 60, newRatio: 120 }];
    expect(ratioFactor(changes, "SPY", d("2025-01-01"))).toBe(6);
    expect(ratioFactor(changes, "SPY", d("2026-07-01"))).toBe(2);
  });
});

describe("adjustForRatioChanges", () => {
  it("pasa la operación a CEDEARs del ratio actual sin cambiar el monto", () => {
    const trade = { ticker: "SPY", date: d("2025-10-06"), quantity: 1, price: 51325, fee: 310.52 };
    const adjusted = adjustForRatioChanges(trade, [spy]);
    expect(adjusted.quantity).toBe(3);
    expect(adjusted.price).toBeCloseTo(51325 / 3);
    expect(adjusted.quantity * adjusted.price).toBeCloseTo(51325);
    expect(adjusted.fee).toBe(310.52);
  });

  it("devuelve la misma operación si no hay cambio que la afecte", () => {
    const trade = { ticker: "SPY", date: d("2026-07-01"), quantity: 2, price: 20000 };
    expect(adjustForRatioChanges(trade, [spy])).toBe(trade);
  });
});
