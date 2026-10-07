import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-session";
import { userTags } from "@/lib/cache-tags";

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
