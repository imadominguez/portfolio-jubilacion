import { describe, expect, it } from "vitest";
import {
  daysBeforeYearEnd,
  defaultTaxYear,
  dividendRows,
  dividendsForYear,
  lastSnapshotPerYear,
  salesForYear,
  taxReportCsv,
  taxYears,
  totalDividendsUsd,
  totalsByCurrency,
  type TradeForTax,
} from "./tax-report";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("tenencia al cierre", () => {
  it("toma el último snapshot de cada año", () => {
    const snaps = [
      { id: "a", snapshotDate: day("2024-06-30") },
      { id: "b", snapshotDate: day("2024-12-31") },
      { id: "c", snapshotDate: day("2025-03-01") },
    ];
    const byYear = lastSnapshotPerYear(snaps);
    expect(byYear.get(2024)?.id).toBe("b");
    expect(byYear.get(2025)?.id).toBe("c");
  });

  it("mide la distancia al 31/12", () => {
    expect(daysBeforeYearEnd(day("2025-12-31"))).toBe(0);
    expect(daysBeforeYearEnd(day("2025-12-29"))).toBe(2);
    expect(daysBeforeYearEnd(day("2025-03-01"))).toBe(305);
  });
});

describe("salesForYear", () => {
  const t = (iso: string, type: "BUY" | "SELL", quantity: number, price: number, fee = 0, ticker = "AAA"): TradeForTax => ({
    date: day(iso),
    ticker,
    type,
    quantity,
    price,
    fee,
    currency: "ARS",
  });

  it("usa costo promedio con las comisiones de compra, aunque sean de años anteriores", () => {
    const sales = salesForYear(
      [t("2024-03-01", "BUY", 10, 100, 10), t("2025-02-01", "BUY", 10, 200, 10), t("2025-06-01", "SELL", 5, 300, 15)],
      2025
    );
    // Costo promedio = (1010 + 2010) / 20 = 151 por unidad.
    expect(sales).toHaveLength(1);
    expect(sales[0].cost).toBeCloseTo(755);
    expect(sales[0].proceeds).toBeCloseTo(1485);
    expect(sales[0].result).toBeCloseTo(730);
    expect(sales[0].missingBuys).toBe(false);
  });

  it("descuenta lo vendido en años anteriores del costo", () => {
    const sales = salesForYear(
      [t("2024-01-01", "BUY", 10, 100), t("2024-06-01", "SELL", 5, 120), t("2025-01-10", "SELL", 5, 150)],
      2025
    );
    expect(sales.map((s) => s.cost)).toEqual([500]);
  });

  it("marca las ventas sin compras suficientes", () => {
    const [sale] = salesForYear([t("2025-01-01", "BUY", 2, 100), t("2025-02-01", "SELL", 3, 100)], 2025);
    expect(sale.cost).toBeCloseTo(200);
    expect(sale.missingBuys).toBe(true);
  });

  it("acepta ventas con cantidad negativa, como las exporta Cocos", () => {
    const [sale] = salesForYear([t("2025-03-10", "BUY", 6, 1000, 60), t("2026-04-15", "SELL", -3, 3000, 90)], 2026);
    expect(sale.quantity).toBe(3);
    expect(sale.proceeds).toBeCloseTo(8910);
    expect(sale.cost).toBeCloseTo(3030);
    expect(sale.result).toBeCloseTo(5880);
  });

  it("usa el monto bruto de Cocos: en bonos y ONs el precio es cada 100 nominales", () => {
    const [sale] = salesForYear(
      [
        { ...t("2026-07-01", "BUY", 1000, 100, 0, "ON1"), amount: -1000 },
        { ...t("2026-07-01", "SELL", -1000, 0.07, 0, "ON1"), currency: "USD", amount: 0.7 },
      ],
      2026
    );
    expect(sale.proceeds).toBeCloseTo(0.7);
    expect(sale.cost).toBeCloseTo(1000);
  });

  it("no calcula el resultado si se compró en otra moneda (dólar MEP)", () => {
    const [sale] = salesForYear(
      [t("2026-07-01", "BUY", 10, 500, 0, "ON1"), { ...t("2026-07-01", "SELL", -10, 0.35, 0, "ON1"), currency: "USD" }],
      2026
    );
    expect(sale.currency).toBe("USD");
    expect(sale.costCurrency).toBe("ARS");
    expect(sale.cost).toBeCloseTo(5000);
    expect(sale.result).toBeNull();
    expect(sale.missingBuys).toBe(false);
  });

  it("deja el costo en null si se compró en las dos monedas", () => {
    const usdBuy: TradeForTax = { ...t("2025-01-02", "BUY", 1, 10), currency: "USD" };
    const [sale] = salesForYear([t("2025-01-01", "BUY", 1, 1000), usdBuy, t("2025-02-01", "SELL", 2, 1200)], 2025);
    expect(sale.cost).toBeNull();
    expect(sale.costCurrency).toBeNull();
    expect(sale.result).toBeNull();
  });
});

describe("dividendsForYear", () => {
  it("lee el monto en USD de la cantidad y los gastos del total en pesos", () => {
    const rows = dividendsForYear(
      [
        { date: day("2025-08-01"), instrument: "Dólar estadounidense", ticker: null, currency: "ARS", quantity: 0.25, grossAmount: 0, total: -12.5 },
        { date: day("2025-07-07"), instrument: "Dólar estadounidense", ticker: null, currency: "ARS", quantity: 0, grossAmount: 0, total: -0.02 },
        { date: day("2025-06-05"), instrument: "ACCION LOCAL (ACC1)", ticker: "ACC1", currency: "ARS", quantity: null, grossAmount: 6, total: 5.5 },
        { date: day("2024-06-05"), instrument: "ACCION LOCAL (ACC1)", ticker: "ACC1", currency: "ARS", quantity: null, grossAmount: 6, total: 6 },
      ],
      [{ date: day("2025-09-01"), ticker: "KO", amount: 1.2, currency: "USD" }],
      2025
    );
    expect(rows.map((r) => [r.source, r.currency, r.amount, r.costsArs, r.manual])).toEqual([
      ["ACC1", "ARS", 6, 0.5, false],
      ["Dólar estadounidense", "USD", 0.25, 12.5, false],
      ["KO", "USD", 1.2, 0, true],
    ]);
    expect(totalsByCurrency(rows, (r) => r.amount)).toEqual({ ARS: 6, USD: 1.45 });
  });
});

describe("totalDividendsUsd", () => {
  it("suma los USD y pasa los pesos al CCL de su fecha, sin filtrar por año", () => {
    const rows = dividendRows(
      [
        { date: day("2025-08-01"), instrument: "Dólar estadounidense", ticker: null, currency: "ARS", quantity: 0.25, grossAmount: 0, total: -12.5 },
        { date: day("2024-06-05"), instrument: "ACCION LOCAL (ACC1)", ticker: "ACC1", currency: "ARS", quantity: null, grossAmount: 6, total: 6 },
        { date: day("2019-01-01"), instrument: "ACCION LOCAL (ACC1)", ticker: "ACC1", currency: "ARS", quantity: null, grossAmount: 9, total: 9 },
      ],
      [{ date: day("2026-09-01"), ticker: "KO", amount: 1.2, currency: "USD" }]
    );
    const cclAt = (date: Date) => (date.getUTCFullYear() < 2020 ? null : 1200);
    expect(totalDividendsUsd(rows, cclAt)).toBeCloseTo(0.25 + 1.2 + 6 / 1200);
  });
});

describe("años", () => {
  it("lista los años con datos y elige el último cerrado", () => {
    const years = taxYears([day("2024-01-01"), day("2026-05-01"), day("2025-12-31"), day("2026-01-02")]);
    expect(years).toEqual([2026, 2025, 2024]);
    expect(defaultTaxYear(years, 2026)).toBe(2025);
    expect(defaultTaxYear([2026], 2026)).toBe(2026);
    expect(defaultTaxYear([], 2026)).toBeNull();
  });
});

describe("taxReportCsv", () => {
  it("arma las tres secciones con BOM, punto y coma y coma decimal", () => {
    const csv = taxReportCsv({
      year: 2025,
      holdings: {
        snapshotDate: day("2025-12-31"),
        totalValueArs: 1500.5,
        ccl: 1500,
        daysBeforeYearEnd: 0,
        positions: [{ ticker: "AMD", instrumentName: "CEDEAR AMD; INC", quantity: 1.5, price: 1000.33, value: 1500.5 }],
      },
      sales: [],
      dividends: [{ date: day("2025-08-01"), source: "Dólar estadounidense", currency: "USD", amount: 0.25, costsArs: 12.5, manual: false }],
    });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('AMD;"CEDEAR AMD; INC";1,5;1000,3300;1500,50');
    expect(csv).toContain("2025-08-01;Dólar estadounidense;USD;0,25;12,50;Cocos");
    expect(csv).toContain("Ventas 2025");
  });
});
