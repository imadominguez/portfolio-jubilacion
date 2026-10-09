"use server";

import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { revalidateBenchmarks } from "@/lib/revalidate";
import { marketTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { saveBenchmark } from "@/lib/market-refresh";
import { BENCHMARKS, type BenchmarkId } from "@/lib/benchmarks-config";

export type BenchmarkFetchResult =
  | { success: true; benchmarkId: string; saved: number }
  | { success: false; error: string; benchmarkId: string };

export async function fetchAndSaveBenchmark(
  benchmarkId: BenchmarkId,
  fromDate: Date,
  toDate: Date = new Date()
): Promise<BenchmarkFetchResult> {
  const benchmark = BENCHMARKS[benchmarkId];
  if (!benchmark) {
    return { success: false, error: "Benchmark no reconocido.", benchmarkId };
  }

  try {
    const saved = await saveBenchmark(benchmarkId, fromDate, toDate);
    revalidateBenchmarks();
    return { success: true, benchmarkId, saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message, benchmarkId };
  }
}

export type BenchmarkPoint = {
  date: Date;
  value: number;
  normalizedValue: number | null;
};

export async function getBenchmarkPoints(
  benchmarkId: string,
  fromDate?: Date
): Promise<BenchmarkPoint[]> {
  // Sin datos de request, Next la ejecutaría en el build contra la base (que en
  // CI no existe) y congelaría la serie en el shell del deploy.
  await connection();
  return cachedBenchmarkPoints(benchmarkId, fromDate);
}

// Datos globales: las series solo cambian con el refresco manual (ADR-0006).
// benchmarkId y fromDate forman parte de la clave del caché.
async function cachedBenchmarkPoints(
  benchmarkId: string,
  fromDate?: Date
): Promise<BenchmarkPoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(marketTags.benchmarks);

  const points = await db.benchmarkPoint.findMany({
    where: {
      benchmarkId,
      ...(fromDate ? { date: { gte: fromDate } } : {}),
    },
    orderBy: { date: "asc" },
  });

  if (points.length === 0) return [];

  const firstValue = Number(points[0].value);

  return points.map((p) => ({
    date: p.date,
    value: Number(p.value),
    normalizedValue: firstValue > 0 ? (Number(p.value) / firstValue) * 100 : null,
  }));
}
