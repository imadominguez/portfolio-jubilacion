"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import yahooFinance from "yahoo-finance2";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = await yahooFinance.historical(
      benchmark.ticker,
      {
        period1: fromDate,
        period2: toDate,
        interval: "1d",
      },
      { validateResult: false }
    );

    if (!result || result.length === 0) {
      return { success: false, error: "No se obtuvieron datos históricos.", benchmarkId };
    }

    let saved = 0;
    for (const row of result) {
      if (!row.close) continue;
      const date = new Date(row.date);
      date.setHours(0, 0, 0, 0);

      await db.benchmarkPoint.upsert({
        where: { benchmarkId_date: { benchmarkId, date } },
        create: { benchmarkId, date, value: row.close },
        update: { value: row.close },
      });
      saved++;
    }

    revalidatePath("/performance");
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
  benchmarkId: BenchmarkId,
  fromDate?: Date
): Promise<BenchmarkPoint[]> {
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
