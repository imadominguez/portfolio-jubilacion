"use server";

import { revalidateHistoricalPrices } from "@/lib/revalidate";
import { saveStockHistory } from "@/lib/market-refresh";

export type StockHistoryResult =
  | { success: true; results: { ticker: string; saved: number; skipped: number }[] }
  | { success: false; error: string };

// Para cada Asset con underlyingTicker, baja el historial de precios USD desde
// la primera compra registrada y guarda las fechas que faltan en
// historical_price_cache. El cron diario lo hace de forma incremental (ADR-0021).
export async function fetchAndCacheStockHistory(): Promise<StockHistoryResult> {
  try {
    const results = await saveStockHistory();
    revalidateHistoricalPrices();
    return { success: true, results };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al obtener precios históricos.";
    return { success: false, error: message };
  }
}
