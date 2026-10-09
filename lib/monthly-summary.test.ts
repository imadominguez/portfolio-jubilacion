import { describe, expect, it } from "vitest";
import { buildMonthlySummaryEmail, summaryMonthDue } from "./monthly-summary";

// 12:00 UTC = 9:00 en Argentina.
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("summaryMonthDue", () => {
  it("espera al día del recordatorio y a que el mes esté cargado", () => {
    expect(summaryMonthDue(at("2026-11-04"), 5, true)).toBeNull();
    expect(summaryMonthDue(at("2026-11-05"), 5, true)).toBe("2026-10");
    expect(summaryMonthDue(at("2026-11-10"), 5, false)).toBeNull();
  });

  it("desde el día 20 lo manda aunque falten datos", () => {
    expect(summaryMonthDue(at("2026-11-20"), 5, false)).toBe("2026-10");
    expect(summaryMonthDue(at("2027-01-21"), 5, false)).toBe("2026-12");
  });
});

describe("buildMonthlySummaryEmail", () => {
  const mail = buildMonthlySummaryEmail({
    monthKey: "2026-10",
    year: 2026,
    portfolio: { valueArs: 2_814_068, valueUsd: 1732, yearReturnArsPct: 35.28, yearReturnUsdPct: 24.8 },
    cashFlow: { deposits: 1_161_338, expenses: 686_350, savings: 474_988, savingsRate: 40.9 },
    topCategories: [{ label: "Comida afuera y delivery", total: 300_000, pct: 43.7 }],
    uncategorized: 4,
    plan: {
      mode: "compra",
      amountArs: 500_000,
      reportDate: "08 oct 2026",
      rows: [
        { ticker: "MELI", amountArs: 250_000, estimatedCedears: 10 },
        { ticker: "KO", amountArs: 0, estimatedCedears: null },
      ],
    },
    missingData: ["los movimientos"],
    appUrl: "https://app.test/",
  });

  it("arma el asunto con el mes", () => {
    expect(mail.subject).toBe("Portfolio: resumen de octubre 2026");
  });

  it("incluye rendimiento, flujo, gastos, el plan y lo que falta", () => {
    expect(mail.text).toContain("Rendimiento 2026 sin aportes: +35,3 % en pesos, +24,8 % en dólares");
    expect(mail.text).toContain("Ahorro: $ 474.988 (tasa 41 %).");
    expect(mail.text).toContain("4 pagos sin categoría");
    expect(mail.text).toContain("MELI: $ 250.000 (~10 CEDEARs)");
    expect(mail.text).not.toContain("KO:");
    expect(mail.text).toContain("Faltan datos de octubre 2026: los movimientos.");
    expect(mail.html).toContain("https://app.test/alertas");
  });
});
