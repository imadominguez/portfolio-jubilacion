"use server";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-session";
import { marketTags, userTags } from "@/lib/cache-tags";
import { cclLookup, monthlyCashFlow, type MonthCashFlow } from "@/lib/cash-flow";

// Meses que se muestran: el año completo anterior más el mes en curso.
const MONTHS = 13;
const CASH_CATEGORIES = [
  "RECEIPT",
  "PAYMENT",
  "TRADE_BUY",
  "TRADE_SELL",
  "FCI_SUBSCRIPTION",
  "FCI_REDEMPTION",
] as const;

export async function getCashFlow(): Promise<MonthCashFlow[]> {
  return cachedCashFlow(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedCashFlow(userId: string): Promise<MonthCashFlow[]> {
  "use cache";
  cacheLife("hours");
  // Movimientos del usuario y el CCL para pasar a pesos los de dólares.
  cacheTag(userTags.trades(userId), marketTags.ccl);

  const [movements, rates] = await Promise.all([
    db.movement.findMany({
      where: { userId, category: { in: [...CASH_CATEGORIES] } },
      orderBy: { date: "asc" },
      select: { date: true, category: true, currency: true, total: true },
    }),
    db.exchangeRate.findMany({ orderBy: { date: "asc" }, select: { date: true, ccl: true } }),
  ]);

  const months = monthlyCashFlow(
    movements.map((m) => ({ ...m, total: Number(m.total) })),
    cclLookup(rates.map((r) => ({ date: r.date, ccl: Number(r.ccl) })))
  );
  return months.slice(-MONTHS);
}
