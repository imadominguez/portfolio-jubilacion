import { db } from "@/lib/db";
import { fetchWithTimeout } from "@/lib/http";
import { getHistorical, getQuotes } from "@/lib/yahoo-finance-client";
import { BENCHMARKS, INDEX_BENCHMARKS, type BenchmarkId } from "@/lib/benchmarks-config";
import { buildCumulativeIndex } from "@/lib/inflation";
import { marketTags } from "@/lib/cache-tags";

// Bajar y guardar los datos de mercado globales (CCL, precios, históricos,
// benchmarks, IPC y CER). Lo usan las Server Actions de los botones, que
// después invalidan con updateTag, y el cron diario (ADR-0021), que invalida
// con revalidateTag porque updateTag solo funciona en Server Actions.
// Las funciones lanzan en error: el que llama decide cómo informarlo.

const DAY_MS = 24 * 60 * 60 * 1000;
// Días hacia atrás desde el último dato guardado: Yahoo corrige cierres
// recientes y argentinadatos publica con demora.
const OVERLAP_DAYS = 7;

// ---------------------------------------------------------------------------
// CCL
// ---------------------------------------------------------------------------

type DolarApiResponse = { compra: number; venta: number };

export async function saveCurrentCcl(): Promise<{ ccl: number; date: string; alreadyExisted: boolean }> {
  const res = await fetchWithTimeout("https://dolarapi.com/v1/dolares/contadoconliqui", {
    service: "dolarapi.com",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Error al obtener el CCL (HTTP ${res.status}).`);

  const data: DolarApiResponse = await res.json();
  const ccl = data.venta ?? data.compra;
  if (!ccl || ccl <= 0) throw new Error("La API devolvió un valor de CCL inválido.");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await db.exchangeRate.findUnique({ where: { date: today } });
  await db.exchangeRate.upsert({
    where: { date: today },
    create: { date: today, ccl, source: "dolarapi.com" },
    update: { ccl, source: "dolarapi.com" },
  });
  return { ccl, date: today.toISOString().split("T")[0], alreadyExisted: !!existing };
}

// ---------------------------------------------------------------------------
// Precios actuales de los subyacentes
// ---------------------------------------------------------------------------

export async function saveMarketPrices(): Promise<{ updated: number; failed: string[] }> {
  const assets = await db.asset.findMany({
    where: { underlyingTicker: { not: null } },
    select: { underlyingTicker: true },
  });
  const tickers = [...new Set(assets.map((a) => a.underlyingTicker!))];
  if (tickers.length === 0) throw new Error("No hay assets con ticker subyacente configurado.");

  const priceMap = await getQuotes(tickers);
  const failed: string[] = [];
  let updated = 0;
  for (const ticker of tickers) {
    const price = priceMap.get(ticker);
    if (!price || price <= 0) {
      failed.push(ticker);
      continue;
    }
    await db.marketPriceCache.upsert({
      where: { ticker },
      create: { ticker, price, currency: "USD", fetchedAt: new Date() },
      update: { price, fetchedAt: new Date() },
    });
    updated++;
  }
  return { updated, failed };
}

// ---------------------------------------------------------------------------
// Precios históricos de los subyacentes (Ganancia real)
// ---------------------------------------------------------------------------

// `incremental`: cada ticker desde su último cierre guardado (cron). Si no,
// desde la primera compra registrada (botón y wizard de Ganancia real).
export async function saveStockHistory(
  options: { incremental?: boolean } = {}
): Promise<{ ticker: string; saved: number; skipped: number }[]> {
  const assets = await db.asset.findMany({
    where: { underlyingTicker: { not: null } },
    select: { underlyingTicker: true },
  });
  const tickers = [...new Set(assets.map((a) => a.underlyingTicker!))];
  if (tickers.length === 0) {
    throw new Error(
      "No hay assets con ticker subyacente configurado. Agrega el underlyingTicker en la página de Assets."
    );
  }

  const firstBuy = await db.transaction.findFirst({
    where: { type: "BUY" },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  const defaultFrom = firstBuy?.date ?? new Date(Date.now() - 365 * DAY_MS);
  const lastByTicker = options.incremental
    ? new Map(
        (
          await db.historicalPriceCache.groupBy({
            by: ["ticker"],
            where: { ticker: { in: tickers } },
            _max: { date: true },
          })
        ).map((r) => [r.ticker, r._max.date])
      )
    : new Map<string, Date | null>();
  const toDate = new Date();

  const results: { ticker: string; saved: number; skipped: number }[] = [];
  for (const ticker of tickers) {
    const last = lastByTicker.get(ticker);
    const fromDate = last ? new Date(last.getTime() - OVERLAP_DAYS * DAY_MS) : defaultFrom;
    try {
      const history = await getHistorical(ticker, fromDate, toDate);
      const existing = await db.historicalPriceCache.findMany({
        where: { ticker, date: { gte: fromDate, lte: toDate } },
        select: { date: true },
      });
      const existingDates = new Set(existing.map((r) => r.date.toISOString().slice(0, 10)));
      let saved = 0;
      let skipped = 0;
      for (const row of history) {
        if (existingDates.has(row.date.toISOString().slice(0, 10))) {
          skipped++;
          continue;
        }
        await db.historicalPriceCache.upsert({
          where: { ticker_date: { ticker, date: row.date } },
          create: { ticker, date: row.date, priceUsd: row.close },
          update: { priceUsd: row.close },
        });
        saved++;
      }
      results.push({ ticker, saved, skipped });
    } catch {
      results.push({ ticker, saved: 0, skipped: 0 });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Benchmarks (S&P 500, Merval, NASDAQ) e índices (IPC, CER/UVA)
// ---------------------------------------------------------------------------

async function savePoints(benchmarkId: string, points: { date: Date; value: number }[]): Promise<number> {
  for (const p of points) {
    await db.benchmarkPoint.upsert({
      where: { benchmarkId_date: { benchmarkId, date: p.date } },
      create: { benchmarkId, date: p.date, value: p.value },
      update: { value: p.value },
    });
  }
  return points.length;
}

export async function saveBenchmark(benchmarkId: BenchmarkId, fromDate: Date, toDate = new Date()): Promise<number> {
  const benchmark = BENCHMARKS[benchmarkId];
  if (!benchmark) throw new Error("Benchmark no reconocido.");
  const rows = await getHistorical(benchmark.ticker, fromDate, toDate);
  if (rows.length === 0) throw new Error("No se obtuvieron datos históricos.");
  return savePoints(benchmarkId, rows.map((r) => ({ date: r.date, value: r.close })));
}

type ArgentinaDatosPoint = { fecha: string; valor: number };

async function fetchArgentinaDatos(path: string): Promise<{ date: Date; value: number }[]> {
  const res = await fetchWithTimeout(`https://api.argentinadatos.com${path}`, {
    service: "argentinadatos.com",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`argentinadatos.com respondió con HTTP ${res.status}.`);
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("La API no devolvió datos.");
  return (raw as ArgentinaDatosPoint[])
    .map((r) => ({ date: new Date(`${r.fecha}T00:00:00.000Z`), value: Number(r.valor) }))
    .filter((r) => !isNaN(r.date.getTime()) && Number.isFinite(r.value));
}

// IPC mensual (%) → índice acumulado base 100. El nivel de cada mes depende del
// mes de arranque: si ya hay serie guardada se reconstruye desde su primer
// punto, así los valores nuevos no quedan en otra base que los existentes.
export async function saveInflation(fromDate: Date): Promise<number> {
  const [rows, first] = await Promise.all([
    fetchArgentinaDatos(INDEX_BENCHMARKS.inflacion.path),
    db.benchmarkPoint.findFirst({ where: { benchmarkId: "inflacion" }, orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  const fromTs = Math.min(fromDate.getTime() - 31 * DAY_MS, first?.date.getTime() ?? Number.POSITIVE_INFINITY);
  const rates = rows.filter((r) => r.date.getTime() >= fromTs).map((r) => ({ date: r.date, ratePct: r.value }));
  if (rates.length === 0) throw new Error("Sin datos de inflación en el rango.");
  return savePoints("inflacion", buildCumulativeIndex(rates));
}

// UVA diaria (proxy del CER): ya es un índice, se guarda directo.
export async function saveCer(fromDate: Date): Promise<number> {
  const rows = await fetchArgentinaDatos(INDEX_BENCHMARKS.cer.path);
  const points = rows.filter((r) => r.date.getTime() >= fromDate.getTime() - 5 * DAY_MS);
  if (points.length === 0) throw new Error("Sin datos de CER en el rango.");
  return savePoints("cer", points);
}

// ---------------------------------------------------------------------------
// Corrida diaria (cron)
// ---------------------------------------------------------------------------

export type RefreshStep = { step: string; ok: boolean; detail: string };

// Actualiza todo lo global de forma incremental. Un paso que falla no corta al
// resto. Devuelve qué tags del caché hay que invalidar.
export async function refreshMarketData(): Promise<{ steps: RefreshStep[]; tags: string[] }> {
  const steps: RefreshStep[] = [];
  const tags = new Set<string>();
  const run = async (step: string, tag: string, fn: () => Promise<string>) => {
    try {
      steps.push({ step, ok: true, detail: await fn() });
      tags.add(tag);
    } catch (err) {
      steps.push({ step, ok: false, detail: err instanceof Error ? err.message : "Error inesperado." });
    }
  };

  const firstSnapshot = await db.portfolioSnapshot.findFirst({
    orderBy: { snapshotDate: "asc" },
    select: { snapshotDate: true },
  });
  const defaultFrom = firstSnapshot?.snapshotDate ?? new Date(Date.now() - 5 * 365 * DAY_MS);
  const lastPoint = async (benchmarkId: string) =>
    (await db.benchmarkPoint.findFirst({ where: { benchmarkId }, orderBy: { date: "desc" }, select: { date: true } }))
      ?.date ?? null;
  const since = (last: Date | null) => (last ? new Date(last.getTime() - OVERLAP_DAYS * DAY_MS) : defaultFrom);

  await run("ccl", marketTags.ccl, async () => {
    const r = await saveCurrentCcl();
    return `${r.ccl} (${r.date})`;
  });
  await run("precios", marketTags.marketPrices, async () => {
    const r = await saveMarketPrices();
    return `${r.updated} actualizados${r.failed.length ? `, fallaron ${r.failed.join(", ")}` : ""}`;
  });
  await run("históricos", marketTags.historicalPrices, async () => {
    const r = await saveStockHistory({ incremental: true });
    return `${r.reduce((acc, x) => acc + x.saved, 0)} cierres nuevos`;
  });
  for (const id of Object.keys(BENCHMARKS) as BenchmarkId[]) {
    await run(id, marketTags.benchmarks, async () => `${await saveBenchmark(id, since(await lastPoint(id)))} puntos`);
  }
  // saveInflation reconstruye desde el primer mes guardado (misma base).
  await run("inflacion", marketTags.benchmarks, async () => `${await saveInflation(defaultFrom)} meses`);
  await run("cer", marketTags.benchmarks, async () => `${await saveCer(since(await lastPoint("cer")))} días`);

  return { steps, tags: [...tags] };
}
