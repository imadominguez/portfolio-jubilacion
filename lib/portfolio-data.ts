import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { tradeGrossAmount } from "@/lib/trade-amount";
import type { Currency } from "@/app/generated/prisma/client";
import { requireUserId } from "@/lib/auth-session";
import { marketTags, userTags } from "@/lib/cache-tags";
import { flowsFromMovements, type CashFlow } from "@/lib/flow-returns";
import { cclLookup, contributionStats, type ContributionStats } from "@/lib/cash-flow";

// Los getters exportados resuelven el usuario de la sesión y delegan en una
// función cacheada no exportada que recibe solo el `userId`: así nadie puede
// leer datos de otro usuario pasando otro id (ADR-0017).

export type PositionRow = {
  ticker: string;
  instrumentName: string | null;
  quantity: number;
  price: number;
  positionValue: number;
  allocationPct: number;
};

export type SnapshotData = {
  id: string;
  snapshotDate: Date;
  totalValueArs: number;
  totalValueUsd: number | null;
  ccl: number | null;
  positions: PositionRow[];
};

export async function getLatestSnapshot(): Promise<SnapshotData | null> {
  return cachedLatestSnapshot(await requireUserId());
}

async function cachedLatestSnapshot(userId: string): Promise<SnapshotData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.snapshots(userId));

  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotDate: "desc" },
    include: {
      positions: {
        orderBy: { positionValue: "desc" },
      },
    },
  });

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    totalValueArs: Number(snapshot.totalValueArs),
    totalValueUsd: snapshot.totalValueUsd ? Number(snapshot.totalValueUsd) : null,
    ccl: snapshot.ccl ? Number(snapshot.ccl) : null,
    positions: snapshot.positions.map((p) => ({
      ticker: p.ticker,
      instrumentName: p.instrumentName,
      quantity: Number(p.quantity),
      price: Number(p.price),
      positionValue: Number(p.positionValue),
      allocationPct: Number(p.allocationPct) * 100,
    })),
  };
}

export async function getPreviousSnapshot(
  beforeDate: Date
): Promise<{ totalValueArs: number } | null> {
  const userId = await requireUserId();
  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { snapshotDate: { lt: beforeDate }, userId },
    orderBy: { snapshotDate: "desc" },
    select: { totalValueArs: true },
  });

  if (!snapshot) return null;
  return { totalValueArs: Number(snapshot.totalValueArs) };
}

export type PreviousSnapshotData = {
  snapshotDate: Date;
  totalValueArs: number;
  positions: PositionRow[];
};

export async function getPreviousSnapshotFull(
  beforeDate: Date
): Promise<PreviousSnapshotData | null> {
  return cachedPreviousSnapshotFull(await requireUserId(), beforeDate);
}

async function cachedPreviousSnapshotFull(
  userId: string,
  beforeDate: Date
): Promise<PreviousSnapshotData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.snapshots(userId));

  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { snapshotDate: { lt: beforeDate }, userId },
    orderBy: { snapshotDate: "desc" },
    include: {
      positions: {
        orderBy: { positionValue: "desc" },
      },
    },
  });

  if (!snapshot) return null;

  return {
    snapshotDate: snapshot.snapshotDate,
    totalValueArs: Number(snapshot.totalValueArs),
    positions: snapshot.positions.map((p) => ({
      ticker: p.ticker,
      instrumentName: p.instrumentName,
      quantity: Number(p.quantity),
      price: Number(p.price),
      positionValue: Number(p.positionValue),
      allocationPct: Number(p.allocationPct) * 100,
    })),
  };
}

export async function getSnapshotCount(): Promise<number> {
  const userId = await requireUserId();
  return db.portfolioSnapshot.count({ where: { userId } });
}

export type SnapshotPoint = {
  id: string;
  snapshotDate: Date;
  totalValueArs: number;
  totalValueUsd: number | null;
  ccl: number | null;
  positionCount: number;
};

export async function getAllSnapshotPoints(): Promise<SnapshotPoint[]> {
  return cachedAllSnapshotPoints(await requireUserId());
}

async function cachedAllSnapshotPoints(userId: string): Promise<SnapshotPoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.snapshots(userId));

  const snapshots = await db.portfolioSnapshot.findMany({
    where: { userId },
    orderBy: { snapshotDate: "asc" },
    select: {
      id: true,
      snapshotDate: true,
      totalValueArs: true,
      totalValueUsd: true,
      ccl: true,
      _count: { select: { positions: true } },
    },
  });

  return snapshots.map((s) => ({
    id: s.id,
    snapshotDate: s.snapshotDate,
    totalValueArs: Number(s.totalValueArs),
    totalValueUsd: s.totalValueUsd ? Number(s.totalValueUsd) : null,
    ccl: s.ccl ? Number(s.ccl) : null,
    positionCount: s._count.positions,
  }));
}

export type SnapshotDetail = {
  id: string;
  snapshotDate: Date;
  totalValueArs: number;
  totalValueUsd: number | null;
  ccl: number | null;
  sourceFile: string | null;
  positions: PositionRow[];
};

// Lectura con ownership de un snapshot puntual y sus posiciones. Se usa en el
// detalle y en las rutas de exportación para no exponer snapshots ajenos. El
// llamador pasa el userId de su propia sesión (este archivo no es "use server").
export async function getSnapshotById(
  id: string,
  userId: string
): Promise<SnapshotDetail | null> {
  return cachedSnapshotById(id, userId);
}

// Cacheada por (id, userId): permite que <Link prefetch={true}> resuelva el
// detalle antes del click (ADR-0017, punto 6).
async function cachedSnapshotById(
  id: string,
  userId: string
): Promise<SnapshotDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.snapshots(userId));

  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { id, userId },
    include: {
      positions: { orderBy: { positionValue: "desc" } },
    },
  });

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    totalValueArs: Number(snapshot.totalValueArs),
    totalValueUsd: snapshot.totalValueUsd ? Number(snapshot.totalValueUsd) : null,
    ccl: snapshot.ccl ? Number(snapshot.ccl) : null,
    sourceFile: snapshot.sourceFile,
    positions: snapshot.positions.map((p) => ({
      ticker: p.ticker,
      instrumentName: p.instrumentName,
      quantity: Number(p.quantity),
      price: Number(p.price),
      positionValue: Number(p.positionValue),
      allocationPct: Number(p.allocationPct) * 100,
    })),
  };
}

// ─── Flujos de las tenencias (rendimiento sin aportes) ────────────────────────

export type HoldingsFlows = {
  // Compras, ventas, FCI y dividendos en ARS (USD convertidos al CCL de su fecha).
  flowsArs: CashFlow[];
  // Los mismos flujos en USD (ARS divididos por el CCL de su fecha).
  flowsUsd: CashFlow[];
  // Último movimiento importado: los períodos posteriores no tienen flujos.
  lastMovementDate: Date | null;
  // Movimientos que no se pudieron convertir por falta de CCL.
  sinCcl: number;
};

export async function getHoldingsFlows(): Promise<HoldingsFlows> {
  return cachedHoldingsFlows(await requireUserId());
}

async function cachedHoldingsFlows(userId: string): Promise<HoldingsFlows> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.trades(userId), marketTags.ccl);

  const [movements, rates] = await Promise.all([
    db.movement.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true, category: true, currency: true, total: true, instrument: true },
    }),
    db.exchangeRate.findMany({ orderBy: { date: "asc" }, select: { date: true, ccl: true } }),
  ]);

  const cclAt = cclLookup(rates.map((r) => ({ date: r.date, ccl: Number(r.ccl) })));

  const { flows: flowsArs, sinCcl } = flowsFromMovements(
    movements.map((m) => ({ ...m, total: Number(m.total) })),
    cclAt
  );
  const flowsUsd = flowsArs.flatMap((f) => {
    const ccl = cclAt(f.date);
    return ccl ? [{ date: f.date, amount: f.amount / ccl }] : [];
  });

  return {
    flowsArs,
    flowsUsd,
    lastMovementDate: movements.length > 0 ? movements[movements.length - 1].date : null,
    sinCcl,
  };
}

// Aporte real promedio en USD en los meses [fromMonth, toMonth] (AAAA-MM), para
// comparar con el aporte configurado en Jubilación. La página calcula la
// ventana con la hora de Argentina y la pasa como argumento.
export async function getContributionStats(fromMonth: string, toMonth: string): Promise<ContributionStats> {
  return cachedContributionStats(await requireUserId(), fromMonth, toMonth);
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedContributionStats(
  userId: string,
  fromMonth: string,
  toMonth: string
): Promise<ContributionStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.trades(userId), marketTags.ccl);

  const [movements, rates] = await Promise.all([
    db.movement.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true, category: true, currency: true, total: true, instrument: true },
    }),
    db.exchangeRate.findMany({ orderBy: { date: "asc" }, select: { date: true, ccl: true } }),
  ]);
  return contributionStats(
    movements.map((m) => ({ ...m, total: Number(m.total) })),
    cclLookup(rates.map((r) => ({ date: r.date, ccl: Number(r.ccl) }))),
    fromMonth,
    toMonth
  );
}

// ---------------------------------------------------------------------------
// PPM (precio promedio ponderado de compra)
// ---------------------------------------------------------------------------

export type PpmRow = {
  ticker: string;
  avgPrice: number;
  totalQuantity: number;
  totalCost: number;
  currency: Currency;
};

// Recibe el userId ya resuelto: la acción calculatePPM (sesión) o el cron, que
// corre sin sesión. Este archivo no es "use server", así que exportarla no la
// vuelve invocable desde el cliente.
export async function getPpmForUser(userId: string): Promise<PpmRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.trades(userId));

  const txs = await db.transaction.findMany({
    where: { type: "BUY", userId },
    orderBy: { date: "asc" },
    include: { movement: { select: { grossAmount: true } } },
  });

  const byTicker = new Map<string, { totalCost: number; totalQty: number; currency: Currency }>();

  for (const tx of txs) {
    const existing = byTicker.get(tx.ticker);
    const cost = tradeGrossAmount({ quantity: Number(tx.quantity), price: Number(tx.price), movementGross: tx.movement?.grossAmount != null ? Number(tx.movement.grossAmount) : null }) + (tx.fee ? Number(tx.fee) : 0);
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
      // Las ventas importadas antes de normalizar el signo tienen cantidad negativa.
      const soldQty = Math.abs(Number(sell.quantity));
      entry.totalQty = Math.max(0, entry.totalQty - soldQty);
      const ppm = entry.totalQty > 0 ? entry.totalCost / (entry.totalQty + soldQty) : 0;
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

// ---------------------------------------------------------------------------
// Lecturas por usuario para tareas sin sesión (cron, ADR-0020 y ADR-0022)
// ---------------------------------------------------------------------------

// Mismas lecturas cacheadas que los getters de arriba, con el userId explícito.
// Solo para código de servidor que ya sabe de quién son los datos (el cron);
// nunca con un userId que llegue del cliente.
export const latestSnapshotForUser = cachedLatestSnapshot;
export const snapshotPointsForUser = cachedAllSnapshotPoints;
export const holdingsFlowsForUser = cachedHoldingsFlows;
