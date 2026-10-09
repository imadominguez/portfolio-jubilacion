import { describe, expect, it } from "vitest";
import { capitalForDividendIncome, projectDividends } from "@/lib/dividend-projection";

describe("projectDividends", () => {
  it("suma el dividendo anual de las acciones equivalentes y descuenta la retención", () => {
    const p = projectDividends([
      // 40 CEDEARs con ratio 2 = 20 acciones × US$ 2 = US$ 40 brutos.
      { ticker: "KO", quantity: 40, cedearRatio: 2, priceUsd: 80, dividendRateUsd: 2 },
      // Sin dividendo: suma valor (baja el rendimiento) pero no ingreso.
      { ticker: "AMZN", quantity: 10, cedearRatio: 1, priceUsd: 160, dividendRateUsd: 0 },
    ]);
    expect(p.annualGrossUsd).toBeCloseTo(40);
    expect(p.annualNetUsd).toBeCloseTo(28);
    expect(p.monthlyNetUsd).toBeCloseTo(28 / 12);
    expect(p.coveredValueUsd).toBeCloseTo(1600 + 1600);
    expect(p.yieldPct).toBeCloseTo(1.25);
    expect(p.rows).toEqual([{ ticker: "KO", annualGrossUsd: 40, valueUsd: 1600, yieldPct: 2.5 }]);
    expect(p.missing).toEqual([]);
  });

  it("deja afuera las posiciones sin dato y ordena por ingreso", () => {
    const p = projectDividends([
      { ticker: "AAPL", quantity: 10, cedearRatio: 1, priceUsd: 200, dividendRateUsd: 1 },
      { ticker: "CVX", quantity: 10, cedearRatio: 1, priceUsd: 150, dividendRateUsd: 6 },
      { ticker: "BONO", quantity: 100, cedearRatio: 1, priceUsd: 1, dividendRateUsd: null },
    ]);
    expect(p.rows.map((r) => r.ticker)).toEqual(["CVX", "AAPL"]);
    expect(p.missing).toEqual(["BONO"]);
  });

  it("sin posiciones da todo en cero", () => {
    const p = projectDividends([]);
    expect(p.annualGrossUsd).toBe(0);
    expect(p.yieldPct).toBe(0);
  });
});

describe("capitalForDividendIncome", () => {
  it("calcula el capital que cubre el gasto con dividendos netos", () => {
    // 2 % bruto → 1,4 % neto; US$ 1.400/mes = 16.800/año → US$ 1.200.000.
    expect(capitalForDividendIncome(1400, 2)).toBeCloseTo(1_200_000);
  });

  it("sin rendimiento no hay capital que alcance", () => {
    expect(capitalForDividendIncome(1000, 0)).toBeNull();
  });
});
