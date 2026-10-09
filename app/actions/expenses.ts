"use server";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireUserId } from "@/lib/auth-session";
import { userTags } from "@/lib/cache-tags";
import { revalidateExpenses } from "@/lib/revalidate";
import { isExpenseCategory, suggestCategories, type Expense } from "@/lib/expenses";
import { isMonthKey, shiftMonth } from "@/lib/local-date";

export type MonthExpenses = {
  expenses: Expense[];
  previous: Expense[];
  // Pagos en dólares del mes: no entran en los totales en pesos.
  usdPayments: number;
  // Categoría sugerida por id de pago sin categoría (monto ya categorizado).
  suggestions: Record<string, string>;
  // Presupuesto mensual por categoría.
  budgets: Record<string, number>;
};

export type ExpenseTagResult = { success: true } | { success: false; error: string };

const NOTE_MAX = 120;
// Meses hacia atrás que se miran para sugerir categorías (y todo lo posterior:
// al revisar un mes viejo sirve lo que se categorizó después).
const SUGGESTION_MONTHS = 6;

function monthBounds(monthKey: string): { gte: Date; lt: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
}

export async function getMonthExpenses(monthKey: string): Promise<MonthExpenses> {
  if (!isMonthKey(monthKey)) throw new Error("Mes inválido.");
  return cachedMonthExpenses(await requireUserId(), monthKey);
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedMonthExpenses(userId: string, monthKey: string): Promise<MonthExpenses> {
  "use cache";
  cacheLife("hours");
  // Los pagos vienen del libro de movimientos (trades); las categorías, de ExpenseTag.
  cacheTag(userTags.trades(userId), userTags.expenses(userId));

  const current = monthBounds(monthKey);
  const prev = monthBounds(shiftMonth(monthKey, -1));
  const [payments, tagged, budgets] = await Promise.all([
    db.movement.findMany({
      where: { userId, category: "PAYMENT", date: { gte: prev.gte, lt: current.lt } },
      orderBy: [{ date: "desc" }, { nroTicket: "desc" }],
      include: { expenseTag: { select: { category: true, note: true } } },
    }),
    // Pagos ya categorizados de los últimos meses, para sugerir por monto.
    db.movement.findMany({
      where: {
        userId,
        category: "PAYMENT",
        currency: "ARS",
        date: { gte: monthBounds(shiftMonth(monthKey, -SUGGESTION_MONTHS)).gte },
        expenseTag: { category: { not: null } },
      },
      select: { id: true, date: true, total: true, expenseTag: { select: { category: true, note: true } } },
    }),
    db.expenseBudget.findMany({ where: { userId }, select: { category: true, amountArs: true } }),
  ]);

  const toExpense = (p: (typeof payments)[number]): Expense => ({
    id: p.id,
    date: p.date,
    // Cocos registra los pagos con total negativo; uno positivo es un reintegro.
    amount: -Number(p.total),
    category: p.expenseTag?.category ?? null,
    note: p.expenseTag?.note ?? null,
  });
  const ars = payments.filter((p) => p.currency === "ARS");
  const expenses = ars.filter((p) => p.date >= current.gte).map(toExpense);
  const history = tagged.map((p) => ({
    id: p.id,
    date: p.date,
    amount: -Number(p.total),
    category: p.expenseTag?.category ?? null,
    note: p.expenseTag?.note ?? null,
  }));

  return {
    expenses,
    suggestions: suggestCategories(expenses, history),
    budgets: Object.fromEntries(budgets.map((b) => [b.category, Number(b.amountArs)])),
    previous: ars.filter((p) => p.date < current.gte).map(toExpense),
    usdPayments: payments.filter((p) => p.currency === "USD" && p.date >= current.gte).length,
  };
}

// Categoría (o null para quitarla) y nota de un pago del usuario.
export async function saveExpenseTag(
  movementId: string,
  category: string | null,
  note: string | null
): Promise<ExpenseTagResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    if (category !== null && !isExpenseCategory(category)) {
      return { success: false, error: "Categoría inválida." };
    }
    const cleanNote = note?.trim().slice(0, NOTE_MAX) || null;

    const payment = await db.movement.findFirst({
      where: { id: movementId, userId, category: "PAYMENT" },
      select: { id: true },
    });
    if (!payment) return { success: false, error: "Pago no encontrado." };

    if (category === null && cleanNote === null) {
      await db.expenseTag.deleteMany({ where: { movementId, userId } });
    } else {
      const values = { category, note: cleanNote };
      await db.expenseTag.upsert({
        where: { movementId },
        create: { movementId, userId, ...values },
        update: values,
      });
    }

    revalidateExpenses(userId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo guardar." };
  }
}

export type BudgetResult = { success: true } | { success: false; error: string };

// Presupuesto mensual por categoría: un monto por categoría, o null/0 para quitarlo.
export async function saveExpenseBudgets(budgets: Record<string, number | null>): Promise<BudgetResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    for (const [category, amount] of Object.entries(budgets)) {
      if (!isExpenseCategory(category)) return { success: false, error: "Categoría inválida." };
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        return { success: false, error: "El presupuesto tiene que ser un monto positivo." };
      }
    }

    await db.$transaction(
      Object.entries(budgets).map(([category, amount]) =>
        amount && amount > 0
          ? db.expenseBudget.upsert({
              where: { userId_category: { userId, category } },
              create: { userId, category, amountArs: amount },
              update: { amountArs: amount },
            })
          : db.expenseBudget.deleteMany({ where: { userId, category } })
      )
    );

    revalidateExpenses(userId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudieron guardar los presupuestos." };
  }
}
