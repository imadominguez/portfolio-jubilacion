"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateTrades } from "@/lib/revalidate";
import { userTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { tradeGrossAmount } from "@/lib/trade-amount";
import { getPpmForUser, type PpmRow as LibPpmRow } from "@/lib/portfolio-data";
import { requireAuth, requireUserId } from "@/lib/auth-session";
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
  // Monto bruto (ver tradeGrossAmount): en bonos el precio es cada 100 nominales.
  amount: number;
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

    revalidateTrades(session.user.id);
    return { success: true, id: tx.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteTransaction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await requireUserId();
    const result = await db.transaction.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return { success: false, error: "No se encontró la transacción." };
    }
    revalidateTrades(userId);
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar la transacción." };
  }
}

export async function getAllTransactions(): Promise<TransactionRow[]> {
  return cachedAllTransactions(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedAllTransactions(userId: string): Promise<TransactionRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.trades(userId));

  const txs = await db.transaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    include: { movement: { select: { grossAmount: true } } },
  });

  return txs.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    type: t.type,
    quantity: Math.abs(Number(t.quantity)),
    price: Number(t.price),
    amount: tradeGrossAmount({ quantity: Number(t.quantity), price: Number(t.price), movementGross: t.movement?.grossAmount != null ? Number(t.movement.grossAmount) : null }),
    currency: t.currency,
    fee: t.fee ? Number(t.fee) : null,
    date: t.date,
    notes: t.notes,
  }));
}

export type PpmRow = LibPpmRow;

export async function calculatePPM(): Promise<PpmRow[]> {
  return getPpmForUser(await requireUserId());
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
  return cachedRealizedPnl(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedRealizedPnl(userId: string): Promise<RealizedPnlRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.trades(userId));

  const sells = await db.transaction.findMany({
    where: { type: "SELL", userId },
    orderBy: { date: "asc" },
    include: { movement: { select: { grossAmount: true } } },
  });

  const buys = await db.transaction.findMany({
    where: { type: "BUY", userId },
    orderBy: { date: "asc" },
    include: { movement: { select: { grossAmount: true } } },
  });

  const tickerBuys = new Map<
    string,
    { qty: number; totalCost: number }
  >();

  // Por ticker y moneda: una ON comprada en pesos y vendida en dólares (dólar
  // MEP) no tiene un resultado comparable y queda afuera, como en el reporte
  // para impuestos.
  const lotKey = (t: { ticker: string; currency: Currency }) => `${t.ticker}|${t.currency}`;
  for (const buy of buys) {
    const existing = tickerBuys.get(lotKey(buy));
    const cost = tradeGrossAmount({ quantity: Number(buy.quantity), price: Number(buy.price), movementGross: buy.movement?.grossAmount != null ? Number(buy.movement.grossAmount) : null });
    if (existing) {
      existing.qty += Number(buy.quantity);
      existing.totalCost += cost;
    } else {
      tickerBuys.set(lotKey(buy), { qty: Number(buy.quantity), totalCost: cost });
    }
  }

  const rows: RealizedPnlRow[] = [];

  for (const sell of sells) {
    const entry = tickerBuys.get(lotKey(sell));
    if (!entry || entry.qty <= 0) continue;

    const avgBuyPrice = entry.qty > 0 ? entry.totalCost / entry.qty : 0;
    const soldQty = Math.abs(Number(sell.quantity));
    const sellPrice = soldQty > 0 ? tradeGrossAmount({ quantity: Number(sell.quantity), price: Number(sell.price), movementGross: sell.movement?.grossAmount != null ? Number(sell.movement.grossAmount) : null }) / soldQty : Number(sell.price);
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
