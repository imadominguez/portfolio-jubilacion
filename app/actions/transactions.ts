"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-session";
import type { TransactionType, Currency } from "@/app/generated/prisma/client";

export type TransactionFormData = {
  ticker: string;
  type: TransactionType;
  quantity: number;
  price: number;
  currency: Currency;
  fee?: number;
  date: string;
  notes?: string;
};

export type TransactionResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type TransactionRow = {
  id: string;
  ticker: string;
  type: TransactionType;
  quantity: number;
  price: number;
  currency: Currency;
  fee: number | null;
  date: Date;
  notes: string | null;
};

export async function createTransaction(
  data: TransactionFormData
): Promise<TransactionResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    if (!data.ticker.trim()) return { success: false, error: "El ticker es obligatorio." };
    if (data.quantity <= 0) return { success: false, error: "La cantidad debe ser mayor a 0." };
    if (data.price <= 0) return { success: false, error: "El precio debe ser mayor a 0." };

    const date = new Date(data.date);
    if (isNaN(date.getTime())) return { success: false, error: "La fecha no es válida." };

    const tx = await db.transaction.create({
      data: {
        ticker: data.ticker.trim().toUpperCase(),
        type: data.type,
        quantity: data.quantity,
        price: data.price,
        currency: data.currency,
        fee: data.fee ?? null,
        date,
        notes: data.notes?.trim() || null,
        userId,
      },
    });

    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true, id: tx.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteTransaction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.transaction.delete({ where: { id } });
    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar la transacción." };
  }
}

export async function getAllTransactions(): Promise<TransactionRow[]> {
  const session = await requireAuth();
  const txs = await db.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  });

  return txs.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    type: t.type,
    quantity: Number(t.quantity),
    price: Number(t.price),
    currency: t.currency,
    fee: t.fee ? Number(t.fee) : null,
    date: t.date,
    notes: t.notes,
  }));
}

export type PpmRow = {
  ticker: string;
  avgPrice: number;
  totalQuantity: number;
  totalCost: number;
  currency: Currency;
};

export async function calculatePPM(): Promise<PpmRow[]> {
  const session = await requireAuth();
  const userId = session.user.id;
  const txs = await db.transaction.findMany({
    where: { type: "BUY", userId },
    orderBy: { date: "asc" },
  });

  const byTicker = new Map<string, { totalCost: number; totalQty: number; currency: Currency }>();

  for (const tx of txs) {
    const existing = byTicker.get(tx.ticker);
    const cost = Number(tx.quantity) * Number(tx.price) + (tx.fee ? Number(tx.fee) : 0);
    if (existing) {
      existing.totalCost += cost;
      existing.totalQty += Number(tx.quantity);
    } else {
      byTicker.set(tx.ticker, {
        totalCost: cost,
        totalQty: Number(tx.quantity),
        currency: tx.currency,
      });
    }
  }

  const sells = await db.transaction.findMany({
    where: { type: "SELL", userId },
    orderBy: { date: "asc" },
  });

  for (const sell of sells) {
    const entry = byTicker.get(sell.ticker);
    if (entry) {
      entry.totalQty = Math.max(0, entry.totalQty - Number(sell.quantity));
      const ppm = entry.totalQty > 0 ? entry.totalCost / (entry.totalQty + Number(sell.quantity)) : 0;
      entry.totalCost = ppm * entry.totalQty;
    }
  }

  return Array.from(byTicker.entries())
    .filter(([, v]) => v.totalQty > 0)
    .map(([ticker, v]) => ({
      ticker,
      avgPrice: v.totalQty > 0 ? v.totalCost / v.totalQty : 0,
      totalQuantity: v.totalQty,
      totalCost: v.totalCost,
      currency: v.currency,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export type RealizedPnlRow = {
  ticker: string;
  quantity: number;
  sellPrice: number;
  buyPrice: number;
  pnl: number;
  pnlPct: number;
  date: Date;
};

export async function getRealizedPnl(): Promise<RealizedPnlRow[]> {
  const session = await requireAuth();
  const userId = session.user.id;
  const sells = await db.transaction.findMany({
    where: { type: "SELL", userId },
    orderBy: { date: "asc" },
  });

  const buys = await db.transaction.findMany({
    where: { type: "BUY", userId },
    orderBy: { date: "asc" },
  });

  const tickerBuys = new Map<
    string,
    { qty: number; totalCost: number }
  >();

  for (const buy of buys) {
    const existing = tickerBuys.get(buy.ticker);
    const cost = Number(buy.quantity) * Number(buy.price);
    if (existing) {
      existing.qty += Number(buy.quantity);
      existing.totalCost += cost;
    } else {
      tickerBuys.set(buy.ticker, { qty: Number(buy.quantity), totalCost: cost });
    }
  }

  const rows: RealizedPnlRow[] = [];

  for (const sell of sells) {
    const entry = tickerBuys.get(sell.ticker);
    if (!entry || entry.qty <= 0) continue;

    const avgBuyPrice = entry.qty > 0 ? entry.totalCost / entry.qty : 0;
    const soldQty = Number(sell.quantity);
    const sellPrice = Number(sell.price);
    const pnl = (sellPrice - avgBuyPrice) * soldQty;
    const pnlPct = avgBuyPrice > 0 ? ((sellPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;

    rows.push({
      ticker: sell.ticker,
      quantity: soldQty,
      sellPrice,
      buyPrice: avgBuyPrice,
      pnl,
      pnlPct,
      date: sell.date,
    });

    entry.qty -= soldQty;
    entry.totalCost -= avgBuyPrice * soldQty;
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}
