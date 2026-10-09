import { describe, expect, it } from "vitest";
import { liveValuation } from "@/lib/live-valuation";

const d1 = new Date("2026-10-09T12:00:00Z");
const d2 = new Date("2026-10-08T12:00:00Z");

describe("liveValuation", () => {
  it("valúa con el subyacente del día y el último CCL, y deja el resto como en el snapshot", () => {
    const v = liveValuation({
      positions: [
        // 20 CEDEARs ratio 10 = 2 acciones × US$ 100 = US$ 200 → × CCL 1.500 = $ 300.000.
        { ticker: "AAPL", quantity: 20, price: 14_000, positionValue: 280_000 },
        // Bono: sin subyacente, queda con su valor del snapshot.
        { ticker: "AL30", quantity: 100, price: 700, positionValue: 70_000 },
      ],
      prices: [{ ticker: "AAPL", priceUsd: 100, cedearRatio: 10, fetchedAt: d1 }],
      ppm: [{ ticker: "AAPL", avgPrice: 12_000 }],
      snapshotCcl: 1_400,
      currentCcl: 1_500,
    })!;
    expect(v.valueArs).toBeCloseTo(300_000 + 70_000);
    expect(v.valueUsd).toBeCloseTo(200 + 50);
    // Precio en pesos de hoy: 100 / 10 × 1.500 = 15.000; (15.000 − 12.000) × 20.
    expect(v.unrealizedPnlArs).toBeCloseTo(60_000);
    expect(v.pricedCount).toBe(1);
    expect(v.ccl).toBe(1_500);
  });

  it("sin CCL actual usa el del snapshot y toma el precio más viejo como fecha", () => {
    const v = liveValuation({
      positions: [
        { ticker: "KO", quantity: 10, price: 1, positionValue: 10 },
        { ticker: "MSFT", quantity: 30, price: 1, positionValue: 30 },
      ],
      prices: [
        { ticker: "KO", priceUsd: 80, cedearRatio: 5, fetchedAt: d1 },
        { ticker: "MSFT", priceUsd: 500, cedearRatio: 30, fetchedAt: d2 },
      ],
      ppm: [],
      snapshotCcl: 1_000,
      currentCcl: null,
    })!;
    expect(v.ccl).toBe(1_000);
    expect(v.valueUsd).toBeCloseTo(160 + 500);
    expect(v.unrealizedPnlArs).toBeNull();
    expect(v.pricesAsOf).toEqual(d2);
  });

  it("sin ningún precio del día no hay valuación", () => {
    const v = liveValuation({
      positions: [{ ticker: "AL30", quantity: 1, price: 1, positionValue: 1 }],
      prices: [],
      ppm: [],
      snapshotCcl: 1_000,
      currentCcl: 1_100,
    });
    expect(v).toBeNull();
  });
});
