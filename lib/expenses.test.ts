import { describe, expect, it } from "vitest";
import { budgetStatus, expenseCategoryLabel, expenseSummary, isExpenseCategory, suggestCategories, type Expense } from "./expenses";
import { localDateParts, shiftMonth, isMonthKey, daysInMonth } from "./local-date";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const exp = (iso: string, amount: number, category: string | null = null): Expense => ({
  id: `${iso}-${amount}`,
  date: day(iso),
  amount,
  category,
  note: null,
});

describe("local-date", () => {
  it("toma el día y el mes en hora de Argentina", () => {
    // 1/11 a las 01:00 UTC todavía es 31/10 en Argentina.
    expect(localDateParts(new Date("2026-11-01T01:00:00Z"))).toEqual({ year: 2026, month: 10, day: 31 });
  });

  it("mueve meses y valida claves", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("expenseSummary", () => {
  const october = [
    exp("2026-10-01", 1000, "supermercado"),
    exp("2026-10-01", 500),
    exp("2026-10-05", 3000, "vivienda"),
    exp("2026-10-08", -200, "supermercado"), // reintegro
    exp("2026-09-30", 999), // otro mes: se ignora
  ];
  const september = [exp("2026-09-02", 2000), exp("2026-09-20", 4000)];

  it("suma por día, promedia sobre los días transcurridos y proyecta el mes actual", () => {
    const s = expenseSummary(october, september, "2026-10", { year: 2026, month: 10, day: 9 });
    expect(s.total).toBe(4300);
    expect(s.count).toBe(4);
    expect(s.byDay).toHaveLength(9);
    expect(s.byDay[0]).toEqual({ day: 1, total: 1500, count: 2 });
    expect(s.dailyAverage).toBeCloseTo(4300 / 9);
    expect(s.projection).toBeCloseTo((4300 / 9) * 31);
    expect(s.previousSameDay).toBe(2000);
    expect(s.previousTotal).toBe(6000);
  });

  it("agrupa por categoría, con los pagos sin categoría aparte", () => {
    const s = expenseSummary(october, [], "2026-10", { year: 2026, month: 10, day: 9 });
    expect(s.byCategory.map((c) => [c.category, c.total, c.count])).toEqual([
      ["vivienda", 3000, 1],
      ["supermercado", 800, 2],
      ["sin-categoria", 500, 1],
    ]);
    expect(s.uncategorized).toBe(1);
    expect(s.byCategory[0].pct).toBeCloseTo((3000 / 4300) * 100);
  });

  it("un mes pasado usa todos sus días y no proyecta", () => {
    const s = expenseSummary(september, [], "2026-09", { year: 2026, month: 10, day: 9 });
    expect(s.elapsedDays).toBe(30);
    expect(s.byDay).toHaveLength(30);
    expect(s.projection).toBeNull();
    expect(s.dailyAverage).toBe(200);
  });

  it("valida las categorías", () => {
    expect(isExpenseCategory("salud")).toBe(true);
    expect(isExpenseCategory("cualquiera")).toBe(false);
    expect(expenseCategoryLabel(null)).toBe("Sin categorizar");
  });
});

describe("suggestCategories", () => {
  it("sugiere la categoría de un monto ya categorizado y no sugiere si hay empate", () => {
    const history = [
      exp("2026-09-05", 23_675, "servicios"),
      exp("2026-08-05", 23_675, "servicios"),
      exp("2026-09-10", 500, "transporte"),
      exp("2026-09-11", 500, "comida"),
    ];
    const pending = [exp("2026-10-05", 23_675), exp("2026-10-06", 500), exp("2026-10-07", 999), exp("2026-10-08", 23_675, "otros")];
    expect(suggestCategories(pending, history)).toEqual({ "2026-10-05-23675": "servicios" });
  });
});

describe("budgetStatus", () => {
  it("compara lo gastado con el presupuesto de cada categoría", () => {
    const s = expenseSummary([exp("2026-10-01", 1200, "supermercado"), exp("2026-10-02", 300, "salud")], [], "2026-10", { year: 2026, month: 10, day: 9 });
    const rows = budgetStatus(s.byCategory, { supermercado: 1000, salud: 600, ocio: 500, inventada: 100 });
    expect(rows.map((r) => [r.category, r.spent, r.over])).toEqual([
      ["supermercado", 1200, true],
      ["salud", 300, false],
      ["ocio", 0, false],
    ]);
  });
});
