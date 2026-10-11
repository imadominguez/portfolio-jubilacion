"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateDividends } from "@/lib/revalidate";
import { marketTags, userTags } from "@/lib/cache-tags";
import { cclLookup } from "@/lib/cash-flow";
import { dividendRows, totalDividendsUsd } from "@/lib/tax-report";
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
  // Ticker, o el instrumento de Cocos ("Dólar estadounidense" para los de CEDEARs).
  ticker: string;
  amount: number;
  currency: Currency;
  date: Date;
  notes: string | null;
  // Los de Cocos vienen del libro de movimientos y no se borran desde acá.
  manual: boolean;
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
// Los cobros del libro de movimientos (los que informa Cocos) más los cargados a
// mano. Antes solo se listaban los manuales y la pestaña quedaba vacía.
async function cachedAllDividends(userId: string): Promise<DividendRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.dividends(userId), userTags.trades(userId));

  const [manual, movements] = await Promise.all([
    db.dividend.findMany({ where: { userId } }),
    db.movement.findMany({
      where: { userId, category: { in: ["DIVIDEND", "DIVIDEND_IN_KIND"] } },
      select: { id: true, date: true, instrument: true, ticker: true, currency: true, quantity: true, grossAmount: true, total: true },
    }),
  ]);

  const fromLedger = movements.flatMap((m): DividendRow[] =>
    dividendRows(
      [
        {
          ...m,
          quantity: m.quantity !== null ? Number(m.quantity) : null,
          grossAmount: m.grossAmount !== null ? Number(m.grossAmount) : null,
          total: Number(m.total),
        },
      ],
      []
    ).map((r) => ({
      id: m.id,
      ticker: r.source,
      amount: r.amount,
      currency: r.currency,
      date: r.date,
      notes: r.costsArs > 0 ? `Cocos · gastos ${r.costsArs.toFixed(2)} ARS` : "Cocos",
      manual: false,
    }))
  );

  const manualRows: DividendRow[] = manual.map((d) => ({
    id: d.id,
    ticker: d.ticker,
    amount: Number(d.amount),
    currency: d.currency,
    date: d.date,
    notes: d.notes,
    manual: true,
  }));

  return [...fromLedger, ...manualRows].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getTotalDividendsUsd(): Promise<number> {
  return cachedTotalDividendsUsd(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
// Los dividendos de Cocos llegan en el libro de movimientos (la importación
// invalida `trades`); la tabla Dividend son solo los cargados a mano.
async function cachedTotalDividendsUsd(userId: string): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.dividends(userId), userTags.trades(userId), marketTags.ccl);

  const [movements, manual, rates] = await Promise.all([
    db.movement.findMany({
      where: { userId, category: { in: ["DIVIDEND", "DIVIDEND_IN_KIND"] } },
      select: { date: true, instrument: true, ticker: true, currency: true, quantity: true, grossAmount: true, total: true },
    }),
    db.dividend.findMany({ where: { userId }, select: { date: true, ticker: true, amount: true, currency: true } }),
    db.exchangeRate.findMany({ orderBy: { date: "asc" }, select: { date: true, ccl: true } }),
  ]);

  const rows = dividendRows(
    movements.map((m) => ({
      ...m,
      quantity: m.quantity !== null ? Number(m.quantity) : null,
      grossAmount: m.grossAmount !== null ? Number(m.grossAmount) : null,
      total: Number(m.total),
    })),
    manual.map((d) => ({ ...d, amount: Number(d.amount) }))
  );
  return totalDividendsUsd(rows, cclLookup(rates.map((r) => ({ date: r.date, ccl: Number(r.ccl) }))));
}
