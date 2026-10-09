"use server";

import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { revalidateMarketPrices } from "@/lib/revalidate";
import { marketTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { saveMarketPrices } from "@/lib/market-refresh";

export type MarketPriceResult =
  | { success: true; updated: number; failed: string[] }
  | { success: false; error: string };

export type MarketPriceRow = {
  ticker: string;
  underlyingTicker: string;
  priceUsd: number;
  cedearRatio: number;
  // Dividendo anual por acción del subyacente; null si no hay dato.
  dividendRateUsd: number | null;
  fetchedAt: Date;
};

export async function fetchAndSaveMarketPrices(): Promise<MarketPriceResult> {
  try {
    const result = await saveMarketPrices();
    revalidateMarketPrices();
    return { success: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al obtener precios.";
    return { success: false, error: message };
  }
}

export async function getMarketPrices(): Promise<MarketPriceRow[]> {
  // Sin datos de request, Next la ejecutaría en el build contra la base (que en
  // CI no existe) y congelaría los precios en el shell del deploy.
  await connection();
  return cachedMarketPrices();
}

// Datos globales: los precios solo cambian con el refresco manual (ADR-0006).
async function cachedMarketPrices(): Promise<MarketPriceRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(marketTags.assets, marketTags.marketPrices);

  const assets = await db.asset.findMany({
    where: { underlyingTicker: { not: null } },
    select: { ticker: true, underlyingTicker: true, cedearRatio: true },
  });

  const underlyingTickers = assets
    .map((a) => a.underlyingTicker)
    .filter(Boolean) as string[];

  if (underlyingTickers.length === 0) return [];

  const prices = await db.marketPriceCache.findMany({
    where: { ticker: { in: underlyingTickers } },
  });

  const priceMap = new Map(prices.map((p) => [p.ticker, p]));

  return assets
    .filter((a) => a.underlyingTicker && priceMap.has(a.underlyingTicker!))
    .map((a) => {
      const cached = priceMap.get(a.underlyingTicker!)!;
      return {
        ticker: a.ticker,
        underlyingTicker: a.underlyingTicker!,
        priceUsd: Number(cached.price),
        cedearRatio: Number(a.cedearRatio),
        dividendRateUsd: cached.dividendRate === null ? null : Number(cached.dividendRate),
        fetchedAt: cached.fetchedAt,
      };
    });
}
