import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-session";

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
  const session = await getSession();
  const userId = session?.user.id;
  const snapshot = await db.portfolioSnapshot.findFirst({
    where: userId ? { userId } : {},
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
  const session = await getSession();
  const userId = session?.user.id;
  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { snapshotDate: { lt: beforeDate }, ...(userId ? { userId } : {}) },
    orderBy: { snapshotDate: "desc" },
    select: { totalValueArs: true },
  });

  if (!snapshot) return null;
  return { totalValueArs: Number(snapshot.totalValueArs) };
}

export type PreviousSnapshotData = {
  totalValueArs: number;
  positions: PositionRow[];
};

export async function getPreviousSnapshotFull(
  beforeDate: Date
): Promise<PreviousSnapshotData | null> {
  const session = await getSession();
  const userId = session?.user.id;
  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { snapshotDate: { lt: beforeDate }, ...(userId ? { userId } : {}) },
    orderBy: { snapshotDate: "desc" },
    include: {
      positions: {
        orderBy: { positionValue: "desc" },
      },
    },
  });

  if (!snapshot) return null;

  return {
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
  const session = await getSession();
  const userId = session?.user.id;
  return db.portfolioSnapshot.count({ where: userId ? { userId } : {} });
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
  const session = await getSession();
  const userId = session?.user.id;
  const snapshots = await db.portfolioSnapshot.findMany({
    where: userId ? { userId } : {},
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
