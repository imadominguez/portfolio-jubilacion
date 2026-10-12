"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateTrades } from "@/lib/revalidate";
import { marketTags, userTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { tradeGrossAmount } from "@/lib/trade-amount";
import { getPpmForUser, loadRatioChanges, type PpmRow as LibPpmRow } from "@/lib/portfolio-data";
import { adjustForRatioChanges } from "@/lib/ratio-changes";
import { salesForYear, type TradeForTax } from "@/lib/tax-report";
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
  // La del cobro de la venta: los resultados en pesos y en dólares no se suman.
  currency: string;
  date: Date;
};

export async function getRealizedPnl(): Promise<RealizedPnlRow[]> {
  return cachedRealizedPnl(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017). Es el
// mismo cálculo que el reporte para impuestos (salesForYear): costo promedio con
// las comisiones de compra y la venta neta de su comisión. Antes se ignoraban las
// comisiones y la misma venta daba un resultado distinto en cada pantalla.
async function cachedRealizedPnl(userId: string): Promise<RealizedPnlRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.trades(userId), marketTags.assets);

  const [txs, ratioChanges] = await Promise.all([
    db.transaction.findMany({
      where: { userId },
      include: { movement: { select: { grossAmount: true } } },
    }),
    loadRatioChanges(),
  ]);

  // En CEDEARs del ratio actual: una venta posterior a un split descuenta
  // unidades que las compras anteriores no tenían (ADR-0023).
  const trades: TradeForTax[] = txs.map((t) =>
    adjustForRatioChanges(
      {
        date: t.date,
        ticker: t.ticker,
        type: t.type,
        quantity: Number(t.quantity),
        price: Number(t.price),
        fee: t.fee ? Number(t.fee) : 0,
        amount: t.movement?.grossAmount != null ? Number(t.movement.grossAmount) : null,
        currency: t.currency,
      },
      ratioChanges
    )
  );

  const years = [...new Set(trades.filter((t) => t.type === "SELL").map((t) => t.date.getUTCFullYear()))];
  const rows: RealizedPnlRow[] = [];
  // Una ON comprada en pesos y vendida en dólares (dólar MEP) no tiene un
  // resultado comparable (result null) y queda afuera, como en impuestos.
  for (const sale of years.flatMap((y) => salesForYear(trades, y))) {
    if (sale.result === null || sale.cost === null || sale.quantity <= 0) continue;
    rows.push({
      ticker: sale.ticker,
      quantity: sale.quantity,
      sellPrice: sale.proceeds / sale.quantity,
      buyPrice: sale.cost / sale.quantity,
      pnl: sale.result,
      pnlPct: sale.cost > 0 ? (sale.result / sale.cost) * 100 : 0,
      currency: sale.currency,
      date: sale.date,
    });
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}
