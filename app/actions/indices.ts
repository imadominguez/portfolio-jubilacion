"use server";

import { revalidateBenchmarks } from "@/lib/revalidate";
import { db } from "@/lib/db";
import { saveCer, saveInflation } from "@/lib/market-refresh";
import { requireUserId } from "@/lib/auth-session";
import { getBenchmarkPoints, type BenchmarkPoint } from "@/app/actions/benchmarks";
import type { IndexBenchmarkId } from "@/lib/benchmarks-config";

export type IndexFetchResult =
  | { success: true; indexId: IndexBenchmarkId; saved: number }
  | { success: false; indexId: IndexBenchmarkId; error: string };

const DAY_MS = 24 * 60 * 60 * 1000;

// IPC mensual (%) → índice acumulado base 100 (ver saveInflation).
export async function fetchAndSaveInflation(fromDate: Date): Promise<IndexFetchResult> {
  const indexId: IndexBenchmarkId = "inflacion";
  try {
    const saved = await saveInflation(fromDate);
    revalidateBenchmarks();
    return { success: true, indexId, saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, indexId, error: message };
  }
}

// UVA diaria (proxy del CER).
export async function fetchAndSaveCer(fromDate: Date): Promise<IndexFetchResult> {
  const indexId: IndexBenchmarkId = "cer";
  try {
    const saved = await saveCer(fromDate);
    revalidateBenchmarks();
    return { success: true, indexId, saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, indexId, error: message };
  }
}

export async function getIndexPoints(
  indexId: IndexBenchmarkId,
  fromDate?: Date
): Promise<BenchmarkPoint[]> {
  return getBenchmarkPoints(indexId, fromDate);
}

export type IndicesUpdateResult =
  | { success: true; inflacion: number; cer: number }
  | { success: false; error: string };

// Actualiza IPC y CER/UVA en una sola llamada. Arranca desde el primer snapshot
// del usuario (o 5 años atrás si todavía no importó ninguno).
export async function fetchAndSaveAllIndices(): Promise<IndicesUpdateResult> {
  try {
    const userId = await requireUserId();
    const firstSnapshot = await db.portfolioSnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotDate: "asc" },
      select: { snapshotDate: true },
    });
    const fromDate = firstSnapshot?.snapshotDate ?? new Date(Date.now() - 5 * 365 * DAY_MS);

    const [inflacion, cer] = await Promise.all([
      fetchAndSaveInflation(fromDate),
      fetchAndSaveCer(fromDate),
    ]);

    if (!inflacion.success && !cer.success) {
      return { success: false, error: inflacion.error };
    }

    return {
      success: true,
      inflacion: inflacion.success ? inflacion.saved : 0,
      cer: cer.success ? cer.saved : 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}
