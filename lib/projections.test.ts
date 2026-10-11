import { describe, expect, it } from "vitest";
import { buildProjectionCurve, calculateRetirementGoal, type RetirementInputs } from "./projections";

const base: RetirementInputs = {
  currentAge: 40,
  retirementAge: 65,
  monthlyExpensesUsd: 2000,
  inflationRate: 0.03,
  withdrawalRate: 0.04,
  currentPortfolioUsd: 10000,
  monthlyContribution: 200,
  annualReturnRate: 0.07,
};

describe("calculateRetirementGoal", () => {
  it("el capital necesario cubre el gasto de hoy ajustado por inflación a la edad de retiro", () => {
    const goal = calculateRetirementGoal(base);
    const expensesAt65 = 2000 * Math.pow(1.03, 25);
    expect(goal.monthlyExpensesAtRetirement).toBeCloseTo(expensesAt65);
    expect(goal.capitalNeeded).toBeCloseTo((expensesAt65 * 12) / 0.04);
    expect(goal.yearsRemaining).toBe(25);
  });

  it("con retorno 0 % el capital al retiro es el portfolio más los aportes", () => {
    const goal = calculateRetirementGoal({ ...base, annualReturnRate: 0 });
    expect(goal.capitalAtRetirement).toBeCloseTo(10000 + 200 * 25 * 12);
  });

  it("capitaliza mensualmente portfolio y aportes", () => {
    const r = 0.07 / 12;
    const n = 25 * 12;
    const expected = 10000 * Math.pow(1 + r, n) + 200 * ((Math.pow(1 + r, n) - 1) / r);
    const goal = calculateRetirementGoal(base);
    expect(goal.capitalAtRetirement).toBeCloseTo(expected);
    expect(goal.isOnTrack).toBe(false);
  });

  it("calcula los años hasta la meta cuando va en camino", () => {
    const goal = calculateRetirementGoal({ ...base, monthlyContribution: 5000 });
    expect(goal.isOnTrack).toBe(true);
    expect(goal.yearsToGoal).toBeGreaterThan(0);
    expect(goal.yearsToGoal).toBeLessThanOrEqual(25);
  });
});

describe("buildProjectionCurve", () => {
  it("arranca en el portfolio actual y coincide con el capital al retiro", () => {
    const curve = buildProjectionCurve(base);
    expect(curve[0]).toEqual({ year: 0, age: 40, projected: 10000 });
    const at65 = curve.find((p) => p.age === 65)!;
    expect(at65.projected).toBe(Math.round(calculateRetirementGoal(base).capitalAtRetirement));
  });
});
