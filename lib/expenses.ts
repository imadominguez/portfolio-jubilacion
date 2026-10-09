// Gastos del mes a partir de los pagos ("Orden De Pago") del libro de
// movimientos de Cocos (puro, sin Prisma). Cocos no informa el destino del
// pago: la categoría y la nota las pone el usuario (ExpenseTag).

import { daysInMonth, type LocalDate, monthKeyOf } from "@/lib/local-date";

export const EXPENSE_CATEGORIES = [
  { id: "supermercado", label: "Supermercado" },
  { id: "comida", label: "Comida afuera y delivery" },
  { id: "vivienda", label: "Alquiler y expensas" },
  { id: "servicios", label: "Servicios e impuestos" },
  { id: "transporte", label: "Transporte" },
  { id: "salud", label: "Salud" },
  { id: "educacion", label: "Educación" },
  { id: "ocio", label: "Ocio y salidas" },
  { id: "compras", label: "Compras" },
  { id: "suscripciones", label: "Suscripciones" },
  { id: "transferencias", label: "Transferencias a personas" },
  { id: "otros", label: "Otros" },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];
export const UNCATEGORIZED = "sin-categoria";

const LABELS = new Map<string, string>(EXPENSE_CATEGORIES.map((c) => [c.id, c.label]));

export function isExpenseCategory(id: string): id is ExpenseCategoryId {
  return LABELS.has(id);
}

export function expenseCategoryLabel(id: string | null): string {
  return (id && LABELS.get(id)) ?? "Sin categorizar";
}

export type Expense = {
  id: string;
  // Medianoche UTC del día del pago (columna @db.Date).
  date: Date;
  // Gasto en pesos, positivo. Un reintegro (pago con total positivo) resta.
  amount: number;
  category: string | null;
  note: string | null;
};

export type ExpenseDay = { day: number; total: number; count: number };
export type ExpenseCategoryTotal = { category: string; label: string; total: number; count: number; pct: number };

export type ExpenseSummary = {
  monthKey: string;
  total: number;
  count: number;
  // Días del mes considerados: todos si el mes ya terminó, hasta hoy si es el actual.
  elapsedDays: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
  dailyAverage: number;
  // Solo en el mes actual: promedio diario × días del mes.
  projection: number | null;
  byDay: ExpenseDay[];
  byCategory: ExpenseCategoryTotal[];
  uncategorized: number;
  // Mes anterior hasta el mismo día (comparación pareja a mitad de mes) y completo.
  previousSameDay: number;
  previousTotal: number;
};

function inMonth(date: Date, monthKey: string): boolean {
  return date.toISOString().slice(0, 7) === monthKey;
}

export function expenseSummary(
  expenses: Expense[],
  previous: Expense[],
  monthKey: string,
  today: LocalDate
): ExpenseSummary {
  const totalDays = daysInMonth(monthKey);
  const currentKey = monthKeyOf(today);
  const isCurrentMonth = monthKey === currentKey;
  const elapsedDays = isCurrentMonth ? Math.min(today.day, totalDays) : monthKey < currentKey ? totalDays : 0;

  const month = expenses.filter((e) => inMonth(e.date, monthKey));
  const byDay: ExpenseDay[] = Array.from({ length: totalDays }, (_, i) => ({ day: i + 1, total: 0, count: 0 }));
  for (const e of month) {
    const d = byDay[e.date.getUTCDate() - 1];
    d.total += e.amount;
    d.count++;
  }

  const total = month.reduce((acc, e) => acc + e.amount, 0);
  const categories = new Map<string, { total: number; count: number }>();
  for (const e of month) {
    const key = e.category && isExpenseCategory(e.category) ? e.category : UNCATEGORIZED;
    const c = categories.get(key) ?? { total: 0, count: 0 };
    c.total += e.amount;
    c.count++;
    categories.set(key, c);
  }
  const byCategory = [...categories]
    .map(([category, c]) => ({
      category,
      label: expenseCategoryLabel(category === UNCATEGORIZED ? null : category),
      total: c.total,
      count: c.count,
      pct: total > 0 ? (c.total / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const dailyAverage = elapsedDays > 0 ? total / elapsedDays : 0;
  const prevMonthEnd = previous.reduce((acc, e) => acc + e.amount, 0);
  const sameDayLimit = isCurrentMonth ? today.day : Number.POSITIVE_INFINITY;

  return {
    monthKey,
    total,
    count: month.length,
    elapsedDays,
    daysInMonth: totalDays,
    isCurrentMonth,
    dailyAverage,
    projection: isCurrentMonth ? dailyAverage * totalDays : null,
    byDay: isCurrentMonth ? byDay.slice(0, elapsedDays) : byDay,
    byCategory,
    uncategorized: categories.get(UNCATEGORIZED)?.count ?? 0,
    previousSameDay: previous
      .filter((e) => e.date.getUTCDate() <= sameDayLimit)
      .reduce((acc, e) => acc + e.amount, 0),
    previousTotal: prevMonthEnd,
  };
}
