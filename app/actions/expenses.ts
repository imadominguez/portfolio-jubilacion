"use server";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireUserId } from "@/lib/auth-session";
import { userTags } from "@/lib/cache-tags";
import { revalidateExpenses } from "@/lib/revalidate";
import { isExpenseCategory, type Expense } from "@/lib/expenses";
import { isMonthKey, shiftMonth } from "@/lib/local-date";

export type MonthExpenses = {
  expenses: Expense[];
  previous: Expense[];
  // Pagos en dólares del mes: no entran en los totales en pesos.
  usdPayments: number;
};

export type ExpenseTagResult = { success: true } | { success: false; error: string };

const NOTE_MAX = 120;

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
  const payments = await db.movement.findMany({
    where: { userId, category: "PAYMENT", date: { gte: prev.gte, lt: current.lt } },
    orderBy: [{ date: "desc" }, { nroTicket: "desc" }],
    include: { expenseTag: { select: { category: true, note: true } } },
  });

  const toExpense = (p: (typeof payments)[number]): Expense => ({
    id: p.id,
    date: p.date,
    // Cocos registra los pagos con total negativo; uno positivo es un reintegro.
    amount: -Number(p.total),
    category: p.expenseTag?.category ?? null,
    note: p.expenseTag?.note ?? null,
  });
  const ars = payments.filter((p) => p.currency === "ARS");

  return {
    expenses: ars.filter((p) => p.date >= current.gte).map(toExpense),
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
