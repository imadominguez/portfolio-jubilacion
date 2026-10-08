import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-session";
import { userTags } from "@/lib/cache-tags";
import {
  daysBeforeYearEnd,
  dividendsForYear,
  lastSnapshotPerYear,
  salesForYear,
  taxYears,
  type DividendMovementForTax,
  type ManualDividendForTax,
  type TaxHoldings,
  type TaxReport,
  type TradeForTax,
} from "@/lib/tax-report";

// Datos del reporte para impuestos (/impuestos y su export CSV). Se lee todo
// el historial una vez: el costo de una venta depende de compras de años
// anteriores, y son pocas filas.

export type TaxData = {
  years: number[];
  // Tenencia del último snapshot de cada año, por año.
  holdingsByYear: Record<number, TaxHoldings>;
  trades: TradeForTax[];
  dividendMovements: DividendMovementForTax[];
  manualDividends: ManualDividendForTax[];
};

export async function getTaxData(): Promise<TaxData> {
  return cachedTaxData(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedTaxData(userId: string): Promise<TaxData> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.snapshots(userId), userTags.trades(userId), userTags.dividends(userId));

  const [snapshots, transactions, movements, dividends] = await Promise.all([
    db.portfolioSnapshot.findMany({
      where: { userId },
      select: { id: true, snapshotDate: true, totalValueArs: true, ccl: true },
      orderBy: { snapshotDate: "asc" },
    }),
    db.transaction.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      include: { movement: { select: { grossAmount: true } } },
    }),
    db.movement.findMany({
      where: { userId, category: { in: ["DIVIDEND", "DIVIDEND_IN_KIND"] } },
      orderBy: { date: "asc" },
    }),
    db.dividend.findMany({ where: { userId }, orderBy: { date: "asc" } }),
  ]);

  const yearEnd = [...lastSnapshotPerYear(snapshots).values()];
  const positions = await db.position.findMany({
    where: { snapshotId: { in: yearEnd.map((s) => s.id) } },
    orderBy: { positionValue: "desc" },
  });

  const holdingsByYear: Record<number, TaxHoldings> = {};
  for (const s of yearEnd) {
    holdingsByYear[s.snapshotDate.getUTCFullYear()] = {
      snapshotDate: s.snapshotDate,
      totalValueArs: Number(s.totalValueArs),
      ccl: s.ccl ? Number(s.ccl) : null,
      daysBeforeYearEnd: daysBeforeYearEnd(s.snapshotDate),
      positions: positions
        .filter((p) => p.snapshotId === s.id)
        .map((p) => ({
          ticker: p.ticker,
          instrumentName: p.instrumentName,
          quantity: Number(p.quantity),
          price: Number(p.price),
          value: Number(p.positionValue),
        })),
    };
  }

  const trades: TradeForTax[] = transactions.map((t) => ({
    date: t.date,
    ticker: t.ticker,
    type: t.type,
    quantity: Number(t.quantity),
    price: Number(t.price),
    fee: t.fee ? Number(t.fee) : 0,
    amount: t.movement?.grossAmount != null ? Number(t.movement.grossAmount) : null,
    currency: t.currency,
  }));
  const dividendMovements: DividendMovementForTax[] = movements.map((m) => ({
    date: m.date,
    instrument: m.instrument,
    ticker: m.ticker,
    currency: m.currency,
    quantity: m.quantity !== null ? Number(m.quantity) : null,
    grossAmount: m.grossAmount !== null ? Number(m.grossAmount) : null,
    total: Number(m.total),
  }));
  const manualDividends: ManualDividendForTax[] = dividends.map((d) => ({
    date: d.date,
    ticker: d.ticker,
    amount: Number(d.amount),
    currency: d.currency,
  }));

  return {
    years: taxYears([
      ...snapshots.map((s) => s.snapshotDate),
      ...transactions.filter((t) => t.type === "SELL").map((t) => t.date),
      ...movements.map((m) => m.date),
      ...dividends.map((d) => d.date),
    ]),
    holdingsByYear,
    trades,
    dividendMovements,
    manualDividends,
  };
}

export function buildTaxReport(data: TaxData, year: number): TaxReport {
  return {
    year,
    holdings: data.holdingsByYear[year] ?? null,
    sales: salesForYear(data.trades, year),
    dividends: dividendsForYear(data.dividendMovements, data.manualDividends, year),
  };
}
