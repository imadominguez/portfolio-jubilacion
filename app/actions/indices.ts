"use server";

import { revalidateBenchmarks } from "@/lib/revalidate";
import { db } from "@/lib/db";
import { fetchWithTimeout } from "@/lib/http";
import { requireUserId } from "@/lib/auth-session";
import { getBenchmarkPoints, type BenchmarkPoint } from "@/app/actions/benchmarks";
import { INDEX_BENCHMARKS, type IndexBenchmarkId } from "@/lib/benchmarks-config";
import { buildCumulativeIndex } from "@/lib/inflation";

export type IndexFetchResult =
  | { success: true; indexId: IndexBenchmarkId; saved: number }
  | { success: false; indexId: IndexBenchmarkId; error: string };

type ArgentinaDatosPoint = { fecha: string; valor: number };

const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchArgentinaDatos(
  path: string
): Promise<ArgentinaDatosPoint[] | string> {
  const res = await fetchWithTimeout(`https://api.argentinadatos.com${path}`, {
    service: "argentinadatos.com",
    cache: "no-store",
  });
  if (!res.ok) {
    return `argentinadatos.com respondió con HTTP ${res.status}.`;
  }
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) {
    return "La API no devolvió datos.";
  }
  return raw as ArgentinaDatosPoint[];
}

function parseRows(raw: ArgentinaDatosPoint[]): { date: Date; value: number }[] {
  return raw
    .map((r) => ({
      date: new Date(`${r.fecha}T00:00:00.000Z`),
      value: Number(r.valor),
    }))
    .filter((r) => !isNaN(r.date.getTime()) && Number.isFinite(r.value));
}

async function savePoints(
  benchmarkId: string,
  points: { date: Date; value: number }[]
): Promise<number> {
  let saved = 0;
  for (const p of points) {
    await db.benchmarkPoint.upsert({
      where: { benchmarkId_date: { benchmarkId, date: p.date } },
      create: { benchmarkId, date: p.date, value: p.value },
      update: { value: p.value },
    });
    saved++;
  }
  return saved;
}

// IPC mensual (%) → índice acumulado base 100.
export async function fetchAndSaveInflation(
  fromDate: Date
): Promise<IndexFetchResult> {
  const indexId: IndexBenchmarkId = "inflacion";
  try {
    const raw = await fetchArgentinaDatos(INDEX_BENCHMARKS.inflacion.path);
    if (typeof raw === "string") return { success: false, indexId, error: raw };

    // Un mes de margen hacia atrás para tener base del índice.
    const fromTs = fromDate.getTime() - 31 * DAY_MS;
    const rates = parseRows(raw)
      .filter((r) => r.date.getTime() >= fromTs)
      .map((r) => ({ date: r.date, ratePct: r.value }));

    if (rates.length === 0) {
      return { success: false, indexId, error: "Sin datos de inflación en el rango." };
    }

    const index = buildCumulativeIndex(rates);
    const saved = await savePoints(indexId, index);
    revalidateBenchmarks();
    return { success: true, indexId, saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, indexId, error: message };
  }
}

// UVA diaria (proxy del CER): ya es un índice, se guarda directo.
export async function fetchAndSaveCer(fromDate: Date): Promise<IndexFetchResult> {
  const indexId: IndexBenchmarkId = "cer";
  try {
    const raw = await fetchArgentinaDatos(INDEX_BENCHMARKS.cer.path);
    if (typeof raw === "string") return { success: false, indexId, error: raw };

    const fromTs = fromDate.getTime() - 5 * DAY_MS;
    const points = parseRows(raw).filter((r) => r.date.getTime() >= fromTs);

    if (points.length === 0) {
      return { success: false, indexId, error: "Sin datos de CER en el rango." };
    }

    const saved = await savePoints(indexId, points);
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
