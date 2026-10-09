import { describe, expect, it } from "vitest";
import { cashFlowSummary, cclLookup, contributionStats, monthlyCashFlow, type CashMovement } from "./cash-flow";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const mv = (iso: string, category: string, total: number, currency: "ARS" | "USD" = "ARS"): CashMovement => ({
  date: day(iso),
  category,
  currency,
  total,
});

describe("cclLookup", () => {
  it("usa el CCL del día o el último anterior", () => {
    const at = cclLookup([
      { date: day("2026-07-17"), ccl: 1500 },
      { date: day("2026-07-20"), ccl: 1600 },
    ]);
    expect(at(day("2026-07-19"))).toBe(1500);
    expect(at(day("2026-07-20"))).toBe(1600);
    expect(at(day("2026-07-01"))).toBeNull();
  });
});

describe("monthlyCashFlow", () => {
  const at = () => 1600;

  it("separa depósitos, gastos, inversión y FCI por mes", () => {
    const [sep, oct] = monthlyCashFlow(
      [
        mv("2026-09-03", "RECEIPT", 1_000_000),
        mv("2026-09-10", "PAYMENT", -300_000),
        mv("2026-09-12", "PAYMENT", 20_000), // reintegro
        mv("2026-09-15", "TRADE_BUY", -200_000),
        mv("2026-09-20", "FCI_SUBSCRIPTION", -500_000),
        mv("2026-09-25", "FCI_REDEMPTION", 100_000),
        mv("2026-09-26", "CONVERSION", 7),
        mv("2026-10-01", "RECEIPT", 500_000),
        mv("2026-10-02", "PAYMENT", -600_000),
      ],
      at
    );
    expect(sep).toMatchObject({
      monthKey: "2026-09",
      deposits: 1_000_000,
      expenses: 280_000,
      savings: 720_000,
      invested: 200_000,
      fciNet: 400_000,
    });
    expect(sep.savingsRate).toBeCloseTo(72);
    expect(oct.savings).toBe(-100_000);
    expect(oct.savingsRate).toBeCloseTo(-20);
  });

  it("pasa los dólares al CCL: una ON comprada en pesos y vendida en dólares se compensa", () => {
    const [jul] = monthlyCashFlow(
      [mv("2026-07-20", "TRADE_BUY", -5334.71), mv("2026-07-20", "TRADE_SELL", 3.49, "USD")],
      at
    );
    expect(jul.invested).toBeCloseTo(5334.71 - 3.49 * 1600);
  });

  it("omite los movimientos en dólares sin CCL", () => {
    expect(monthlyCashFlow([mv("2026-07-20", "PAYMENT", -10, "USD")], () => null)).toEqual([]);
  });
});

describe("cashFlowSummary", () => {
  it("pondera la tasa de ahorro por depósitos y promedia los gastos", () => {
    const months = monthlyCashFlow(
      [mv("2026-09-03", "RECEIPT", 1_000_000), mv("2026-09-10", "PAYMENT", -500_000), mv("2026-10-01", "RECEIPT", 500_000), mv("2026-10-02", "PAYMENT", -500_000)],
      () => 1600
    );
    const s = cashFlowSummary(months);
    expect(s.savings).toBe(500_000);
    expect(s.savingsRate).toBeCloseTo((500_000 / 1_500_000) * 100);
    expect(s.averageMonthlyExpenses).toBe(500_000);
  });
});

describe("contributionStats", () => {
  const m = (iso: string, category: string, total: number, instrument: string | null = "X") => ({
    date: day(iso),
    category,
    currency: "ARS" as const,
    total,
    instrument,
  });

  it("promedia el aporte neto en USD y separa lo que fue a CEDEARs y bonos", () => {
    const s = contributionStats(
      [
        m("2026-01-10", "TRADE_BUY", -160_000), // 100 USD
        m("2026-02-10", "FCI_SUBSCRIPTION", -80_000), // 50 USD
        m("2026-03-10", "FCI_REDEMPTION", 160_000), // −100 USD
        m("2026-03-11", "PAYMENT", -160_000, null), // no es un flujo de las tenencias
        m("2025-12-31", "TRADE_BUY", -1_600_000), // fuera de la ventana
      ],
      () => 1600,
      "2026-01",
      "2026-04"
    );
    expect(s.months).toBe(4);
    expect(s.totalUsd).toBeCloseTo(50);
    expect(s.monthlyUsd).toBeCloseTo(12.5);
    expect(s.tradesMonthlyUsd).toBeCloseTo(25);
  });

  it("cuenta los meses entre años", () => {
    expect(contributionStats([], () => 1600, "2025-10", "2026-09").months).toBe(12);
  });
});
