import { describe, expect, it } from "vitest";
import { priceChangesBetween } from "./price-changes";
import type { RatioChange } from "./ratio-changes";

const prevDate = new Date("2026-01-10T00:00:00.000Z");
const currDate = new Date("2026-03-10T00:00:00.000Z");

const split: RatioChange = {
  ticker: "XYZ",
  effectiveDate: new Date("2026-02-01T00:00:00.000Z"),
  oldRatio: 20,
  newRatio: 60,
};

describe("priceChangesBetween", () => {
  it("compara precios sin cambios de ratio", () => {
    const [c] = priceChangesBetween([{ ticker: "ABC", price: 110 }], [{ ticker: "ABC", price: 100 }], prevDate, currDate, []);
    expect(c.pricePct).toBeCloseTo(10);
    expect(c.currentPrice).toBe(110);
  });

  it("un split entre los snapshots no se lee como caída", () => {
    // 300 antes del split equivale a 100 después (60/20 = 3); hoy vale 105.
    const [c] = priceChangesBetween([{ ticker: "XYZ", price: 105 }], [{ ticker: "XYZ", price: 300 }], prevDate, currDate, [split]);
    expect(c.pricePct).toBeCloseTo(5);
  });

  it("un split posterior a los dos snapshots no cambia nada", () => {
    const later = { ...split, effectiveDate: new Date("2026-06-01T00:00:00.000Z") };
    const [c] = priceChangesBetween([{ ticker: "XYZ", price: 330 }], [{ ticker: "XYZ", price: 300 }], prevDate, currDate, [later]);
    expect(c.pricePct).toBeCloseTo(10);
  });

  it("deja afuera las posiciones sin precio anterior o en cero", () => {
    const rows = priceChangesBetween(
      [{ ticker: "NEW", price: 50 }, { ticker: "ZERO", price: 10 }],
      [{ ticker: "ZERO", price: 0 }],
      prevDate,
      currDate,
      []
    );
    expect(rows).toEqual([]);
  });
});
