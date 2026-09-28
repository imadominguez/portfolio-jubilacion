import { describe, expect, it } from "vitest";
import { planDca, type DcaInput } from "./dca-planner";

function baseInput(overrides: Partial<DcaInput> = {}): DcaInput {
  return {
    monthlyAmountArs: 100_000,
    portfolioValueArs: 1_000_000,
    ccl: 1000,
    positions: [],
    targets: [],
    assets: [],
    marketPrices: {},
    ...overrides,
  };
}

describe("planDca", () => {
  it("reparte proporcional al gap entre posiciones infraponderadas", () => {
    // Objetivo 50/50, cartera 1M con 0/0 → gaps iguales → reparto 50/50.
    const plan = planDca(
      baseInput({
        targets: [
          { ticker: "A", targetPct: 50 },
          { ticker: "B", targetPct: 50 },
        ],
      })
    );
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[0].amountArs).toBe(50_000);
    expect(plan.rows[1].amountArs).toBe(50_000);
    expect(plan.totalAllocatedArs).toBe(100_000);
    expect(plan.unallocatedArs).toBe(0);
  });

  it("no asigna capital a posiciones que ya alcanzaron su objetivo", () => {
    // A está en 70% (target 50) → sobreponderada; B en 30% (target 50) → recibe todo.
    const plan = planDca(
      baseInput({
        positions: [
          { ticker: "A", currentPct: 70, currentValue: 700_000 },
          { ticker: "B", currentPct: 30, currentValue: 300_000 },
        ],
        targets: [
          { ticker: "A", targetPct: 50 },
          { ticker: "B", targetPct: 50 },
        ],
      })
    );
    const a = plan.rows.find((r) => r.ticker === "A")!;
    const b = plan.rows.find((r) => r.ticker === "B")!;
    expect(a.amountArs).toBe(0);
    expect(b.amountArs).toBe(100_000);
  });

  it("prioriza la más infraponderada", () => {
    const plan = planDca(
      baseInput({
        positions: [
          { ticker: "A", currentPct: 20, currentValue: 200_000 },
          { ticker: "B", currentPct: 10, currentValue: 100_000 },
        ],
        targets: [
          { ticker: "A", targetPct: 40 },
          { ticker: "B", targetPct: 40 },
        ],
      })
    );
    const a = plan.rows.find((r) => r.ticker === "A")!;
    const b = plan.rows.find((r) => r.ticker === "B")!;
    expect(b.amountArs).toBeGreaterThan(a.amountArs);
  });

  it("respeta el techo del gap y reporta lo no asignado", () => {
    // A sólo necesita 10.000 para llegar al objetivo; el resto queda sin asignar.
    const plan = planDca(
      baseInput({
        monthlyAmountArs: 100_000,
        positions: [{ ticker: "A", currentPct: 0, currentValue: 0 }],
        targets: [{ ticker: "A", targetPct: 1 }],
      })
    );
    const a = plan.rows[0];
    expect(a.gapArs).toBe(10_000);
    expect(a.amountArs).toBe(10_000);
    expect(plan.unallocatedArs).toBe(90_000);
  });

  it("estima CEDEARs a partir del precio del subyacente y el CCL", () => {
    const plan = planDca(
      baseInput({
        targets: [{ ticker: "MSFT", targetPct: 100 }],
        assets: [{ ticker: "MSFT", cedearRatio: 2, underlyingTicker: "MSFT" }],
        marketPrices: { MSFT: 500 },
      })
    );
    const row = plan.rows[0];
    // precio CEDEAR = (500 / 2) * 1000 = 250.000 → 100.000 / 250.000 = 0
    expect(row.cedearPriceArs).toBe(250_000);
    expect(row.estimatedCedears).toBe(0);
  });

  it("usa el precio del snapshot cuando la posición existe", () => {
    const plan = planDca(
      baseInput({
        positions: [{ ticker: "KO", currentPct: 0, currentValue: 0, currentPrice: 10_000 }],
        targets: [{ ticker: "KO", targetPct: 100 }],
      })
    );
    const row = plan.rows[0];
    expect(row.cedearPriceArs).toBe(10_000);
    expect(row.estimatedCedears).toBe(10);
  });

  it("ignora tickers con objetivo 0", () => {
    const plan = planDca(
      baseInput({
        targets: [
          { ticker: "A", targetPct: 100 },
          { ticker: "Z", targetPct: 0 },
        ],
      })
    );
    expect(plan.rows.map((r) => r.ticker)).toEqual(["A"]);
  });
});
