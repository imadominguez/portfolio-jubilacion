import { describe, expect, it } from "vitest";
import {
  daysBeforeYearEnd,
  defaultTaxYear,
  dividendsForYear,
  lastSnapshotPerYear,
  salesForYear,
  taxReportCsv,
  taxYears,
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
  const t = (iso: string, type: "BUY" | "SELL", quantity: number, price: number, fee = 0, ticker = "AMD"): TradeForTax => ({
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
    const [sale] = salesForYear([t("2025-04-08", "BUY", 6, 11975, 69.55), t("2026-05-04", "SELL", -3, 52125, 946.07)], 2026);
    expect(sale.quantity).toBe(3);
    expect(sale.proceeds).toBeCloseTo(155428.93);
    expect(sale.cost).toBeCloseTo(35959.78);
    expect(sale.result).toBeCloseTo(119469.155);
  });

  it("usa el monto bruto de Cocos: en bonos y ONs el precio es cada 100 nominales", () => {
    const [sale] = salesForYear(
      [
        { ...t("2026-07-20", "BUY", 5132, 103.95, 0, "T661O"), amount: -5334.714 },
        { ...t("2026-07-20", "SELL", -5132, 0.068, 0, "T661O"), currency: "USD", amount: 3.4898 },
      ],
      2026
    );
    expect(sale.proceeds).toBeCloseTo(3.4898);
    expect(sale.cost).toBeCloseTo(5334.714);
  });

  it("no calcula el resultado si se compró en otra moneda (dólar MEP)", () => {
    const [sale] = salesForYear(
      [t("2026-07-20", "BUY", 10, 500, 0, "T661O"), { ...t("2026-07-20", "SELL", -10, 0.35, 0, "T661O"), currency: "USD" }],
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
        { date: day("2025-08-01"), instrument: "Dólar estadounidense", ticker: null, currency: "ARS", quantity: 0.36, grossAmount: 0, total: -24.61 },
        { date: day("2025-07-07"), instrument: "Dólar estadounidense", ticker: null, currency: "ARS", quantity: 0, grossAmount: 0, total: -0.02 },
        { date: day("2025-06-05"), instrument: "BCO DE VALORES (VALO)", ticker: "VALO", currency: "ARS", quantity: null, grossAmount: 6, total: 5.5 },
        { date: day("2024-06-05"), instrument: "BCO DE VALORES (VALO)", ticker: "VALO", currency: "ARS", quantity: null, grossAmount: 6, total: 6 },
      ],
      [{ date: day("2025-09-01"), ticker: "KO", amount: 1.2, currency: "USD" }],
      2025
    );
    expect(rows.map((r) => [r.source, r.currency, r.amount, r.costsArs, r.manual])).toEqual([
      ["VALO", "ARS", 6, 0.5, false],
      ["Dólar estadounidense", "USD", 0.36, 24.61, false],
      ["KO", "USD", 1.2, 0, true],
    ]);
    expect(totalsByCurrency(rows, (r) => r.amount)).toEqual({ ARS: 6, USD: 1.56 });
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
      dividends: [{ date: day("2025-08-01"), source: "Dólar estadounidense", currency: "USD", amount: 0.36, costsArs: 24.61, manual: false }],
    });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('AMD;"CEDEAR AMD; INC";1,5;1000,3300;1500,50');
    expect(csv).toContain("2025-08-01;Dólar estadounidense;USD;0,36;24,61;Cocos");
    expect(csv).toContain("Ventas 2025");
  });
});
