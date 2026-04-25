"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-session";

export type TargetAllocationRow = {
  id: string;
  ticker: string;
  targetPct: number;
  notes: string | null;
};

export type RebalanceRow = {
  ticker: string;
  currentPct: number;
  targetPct: number;
  deviation: number;
  currentValue: number;
  suggestedAction: "BUY" | "SELL" | "HOLD";
};

export type TargetAllocationResult =
  | { success: true }
  | { success: false; error: string };

export async function getTargetAllocations(): Promise<TargetAllocationRow[]> {
  const session = await requireAuth();
  const rows = await db.targetAllocation.findMany({
    where: { userId: session.user.id },
    orderBy: { ticker: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    ticker: r.ticker,
    targetPct: Number(r.targetPct) * 100,
    notes: r.notes,
  }));
}

export async function upsertTargetAllocation(
  ticker: string,
  targetPct: number,
  notes?: string
): Promise<TargetAllocationResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    if (!ticker.trim()) return { success: false, error: "El ticker es obligatorio." };
    if (targetPct < 0 || targetPct > 100) {
      return { success: false, error: "El porcentaje debe estar entre 0 y 100." };
    }

    await db.targetAllocation.upsert({
      where: { ticker: ticker.trim().toUpperCase() },
      create: {
        ticker: ticker.trim().toUpperCase(),
        targetPct: targetPct / 100,
        notes: notes?.trim() || null,
        userId,
      },
      update: {
        targetPct: targetPct / 100,
        notes: notes?.trim() || null,
      },
    });

    revalidatePath("/rebalance");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteTargetAllocation(id: string): Promise<TargetAllocationResult> {
  try {
    await db.targetAllocation.delete({ where: { id } });
    revalidatePath("/rebalance");
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar." };
  }
}

export async function getRebalanceData(): Promise<RebalanceRow[]> {
  const session = await requireAuth();
  const userId = session.user.id;
  const [snapshot, targets] = await Promise.all([
    db.portfolioSnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotDate: "desc" },
      include: { positions: true },
    }),
    db.targetAllocation.findMany({ where: { userId } }),
  ]);

  if (!snapshot) return [];

  const total = Number(snapshot.totalValueArs);
  const posMap = new Map(
    snapshot.positions.map((p) => [p.ticker, { pct: Number(p.allocationPct) * 100, value: Number(p.positionValue) }])
  );
  const targetMap = new Map(
    targets.map((t) => [t.ticker, Number(t.targetPct) * 100])
  );

  const allTickers = new Set([...posMap.keys(), ...targetMap.keys()]);
  const rows: RebalanceRow[] = [];

  for (const ticker of allTickers) {
    const currentPct = posMap.get(ticker)?.pct ?? 0;
    const currentValue = posMap.get(ticker)?.value ?? 0;
    const targetPct = targetMap.get(ticker) ?? 0;
    const deviation = currentPct - targetPct;

    let suggestedAction: "BUY" | "SELL" | "HOLD" = "HOLD";
    if (deviation < -1) suggestedAction = "BUY";
    else if (deviation > 1) suggestedAction = "SELL";

    rows.push({ ticker, currentPct, targetPct, deviation, currentValue, suggestedAction });
  }

  return rows.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}
