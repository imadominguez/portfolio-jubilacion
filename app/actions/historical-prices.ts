"use server";

import { db } from "@/lib/db";
import { getHistorical } from "@/lib/yahoo-finance-client";
import { revalidateHistoricalPrices } from "@/lib/revalidate";

export type StockHistoryResult =
  | { success: true; results: { ticker: string; saved: number; skipped: number }[] }
  | { success: false; error: string };

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

    revalidateHistoricalPrices();
    return { success: true, results };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al obtener precios históricos.";
    return { success: false, error: message };
  }
}
