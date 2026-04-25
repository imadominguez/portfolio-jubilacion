"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-session";
import type { Currency } from "@/app/generated/prisma/client";

export type DividendFormData = {
  ticker: string;
  amount: number;
  currency: Currency;
  date: string;
  notes?: string;
};

export type DividendResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type DividendRow = {
  id: string;
  ticker: string;
  amount: number;
  currency: Currency;
  date: Date;
  notes: string | null;
};

export async function createDividend(data: DividendFormData): Promise<DividendResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    if (!data.ticker.trim()) return { success: false, error: "El ticker es obligatorio." };
    if (data.amount <= 0) return { success: false, error: "El monto debe ser mayor a 0." };

    const date = new Date(data.date);
    if (isNaN(date.getTime())) return { success: false, error: "La fecha no es válida." };

    const div = await db.dividend.create({
      data: {
        ticker: data.ticker.trim().toUpperCase(),
        amount: data.amount,
        currency: data.currency,
        date,
        notes: data.notes?.trim() || null,
        userId,
      },
    });

    revalidatePath("/transactions");
    revalidatePath("/performance");
    return { success: true, id: div.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteDividend(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.dividend.delete({ where: { id } });
    revalidatePath("/transactions");
    revalidatePath("/performance");
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar el dividendo." };
  }
}

export async function getAllDividends(): Promise<DividendRow[]> {
  const session = await requireAuth();
  const divs = await db.dividend.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  });

  return divs.map((d) => ({
    id: d.id,
    ticker: d.ticker,
    amount: Number(d.amount),
    currency: d.currency,
    date: d.date,
    notes: d.notes,
  }));
}

export async function getTotalDividendsUsd(): Promise<number> {
  const session = await requireAuth();
  const divs = await db.dividend.findMany({
    where: { currency: "USD", userId: session.user.id },
  });
  return divs.reduce((sum, d) => sum + Number(d.amount), 0);
}
