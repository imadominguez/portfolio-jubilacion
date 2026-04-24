"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getHistorical } from "@/lib/yahoo-finance-client";

export type StockHistoryResult =
  | { success: true; results: { ticker: string; saved: number; skipped: number }[] }
  | { success: false; error: string };

export type HistoricalPriceRow = {
  ticker: string;
  date: Date;
  priceUsd: number;
};

// ---------------------------------------------------------------------------
// fetchAndCacheStockHistory
//
// Para cada Asset con underlyingTicker, obtiene el historial de precios USD
// desde Yahoo Finance (desde la primera transacción BUY disponible hasta hoy)
// y lo persiste en historical_price_cache.
// Solo guarda fechas faltantes (upsert por ticker+date).
// ---------------------------------------------------------------------------

export async function fetchAndCacheStockHistory(): Promise<StockHistoryResult> {
  try {
    const assets = await db.asset.findMany({
      where: { underlyingTicker: { not: null } },
      select: { ticker: true, underlyingTicker: true },
    });

    if (assets.length === 0) {
      return {
        success: false,
        error: "No hay assets con ticker subyacente configurado. Agrega el underlyingTicker en la página de Assets.",
      };
    }

    // Fecha mínima de BUY para delimitar el rango histórico a fetchear
    const firstBuy = await db.transaction.findFirst({
      where: { type: "BUY" },
      orderBy: { date: "asc" },
      select: { date: true },
    });

    const fromDate = firstBuy?.date ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const toDate = new Date();

    const results: { ticker: string; saved: number; skipped: number }[] = [];

    for (const asset of assets) {
      if (!asset.underlyingTicker) continue;

      try {
        const historical = await getHistorical(asset.underlyingTicker, fromDate, toDate);

        if (!historical || historical.length === 0) {
          results.push({ ticker: asset.underlyingTicker, saved: 0, skipped: 0 });
          continue;
        }

        // Obtener fechas ya cacheadas para este ticker
        const existing = await db.historicalPriceCache.findMany({
          where: {
            ticker: asset.underlyingTicker,
            date: { gte: fromDate, lte: toDate },
          },
          select: { date: true },
        });
        const existingDates = new Set(
          existing.map((r) => r.date.toISOString().split("T")[0])
        );

        let saved = 0;
        let skipped = 0;

        for (const row of historical) {
          const dateKey = row.date.toISOString().split("T")[0];
          if (existingDates.has(dateKey)) {
            skipped++;
            continue;
          }

          await db.historicalPriceCache.upsert({
            where: {
              ticker_date: {
                ticker: asset.underlyingTicker,
                date: row.date,
              },
            },
            create: {
              ticker: asset.underlyingTicker,
              date: row.date,
              priceUsd: row.close,
            },
            update: {
              priceUsd: row.close,
            },
          });
          saved++;
        }

        results.push({ ticker: asset.underlyingTicker, saved, skipped });
      } catch {
        results.push({ ticker: asset.underlyingTicker, saved: 0, skipped: 0 });
      }
    }

    revalidatePath("/real-gains");
    return { success: true, results };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al obtener precios históricos.";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// getHistoricalPricesForTicker
//
// Devuelve los precios históricos cacheados para un ticker en un rango.
// ---------------------------------------------------------------------------

export async function getHistoricalPricesForTicker(
  ticker: string,
  from: Date,
  to: Date = new Date()
): Promise<HistoricalPriceRow[]> {
  const rows = await db.historicalPriceCache.findMany({
    where: {
      ticker,
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
  });

  return rows.map((r) => ({
    ticker: r.ticker,
    date: r.date,
    priceUsd: Number(r.priceUsd),
  }));
}

// ---------------------------------------------------------------------------
// getStockHistoryCoverage
//
// Devuelve un resumen de cuántos datos históricos hay por ticker,
// para mostrar el estado en el wizard de la página /real-gains.
// ---------------------------------------------------------------------------

export type CoverageRow = {
  underlyingTicker: string;
  cedearTicker: string;
  cachedPoints: number;
  oldestDate: Date | null;
  newestDate: Date | null;
};

export async function getStockHistoryCoverage(): Promise<CoverageRow[]> {
  const assets = await db.asset.findMany({
    where: { underlyingTicker: { not: null } },
    select: { ticker: true, underlyingTicker: true },
  });

  const rows: CoverageRow[] = [];

  for (const asset of assets) {
    if (!asset.underlyingTicker) continue;

    const agg = await db.historicalPriceCache.aggregate({
      where: { ticker: asset.underlyingTicker },
      _count: { id: true },
      _min: { date: true },
      _max: { date: true },
    });

    rows.push({
      underlyingTicker: asset.underlyingTicker,
      cedearTicker: asset.ticker,
      cachedPoints: agg._count.id,
      oldestDate: agg._min.date,
      newestDate: agg._max.date,
    });
  }

  return rows;
}
