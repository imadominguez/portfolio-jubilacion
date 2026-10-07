"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateDividends } from "@/lib/revalidate";
import { userTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { requireAuth, requireUserId } from "@/lib/auth-session";
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

    revalidateDividends(session.user.id);
    return { success: true, id: div.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteDividend(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await requireUserId();
    const result = await db.dividend.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return { success: false, error: "No se encontró el dividendo." };
    }
    revalidateDividends(userId);
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar el dividendo." };
  }
}

export async function getAllDividends(): Promise<DividendRow[]> {
  return cachedAllDividends(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedAllDividends(userId: string): Promise<DividendRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.dividends(userId));

  const divs = await db.dividend.findMany({
    where: { userId },
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
  return cachedTotalDividendsUsd(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedTotalDividendsUsd(userId: string): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.dividends(userId));

  const divs = await db.dividend.findMany({
    where: { currency: "USD", userId },
  });
  return divs.reduce((sum, d) => sum + Number(d.amount), 0);
}
