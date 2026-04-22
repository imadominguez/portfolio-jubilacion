"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getQuotes } from "@/lib/yahoo-finance-client";

export type MarketPriceResult =
  | { success: true; updated: number; failed: string[] }
  | { success: false; error: string };

export type MarketPriceRow = {
  ticker: string;
  underlyingTicker: string;
  priceUsd: number;
  cedearRatio: number;
  fetchedAt: Date;
};

export async function fetchAndSaveMarketPrices(): Promise<MarketPriceResult> {
  try {
    const assets = await db.asset.findMany({
      where: { underlyingTicker: { not: null } },
      select: { ticker: true, underlyingTicker: true },
    });

    if (assets.length === 0) {
      return { success: false, error: "No hay assets con ticker subyacente configurado." };
    }

    const underlyingTickers = assets
      .map((a) => a.underlyingTicker)
      .filter(Boolean) as string[];

    const failed: string[] = [];
    let updated = 0;

    const priceMap = await getQuotes(underlyingTickers);

    for (const asset of assets) {
      if (!asset.underlyingTicker) continue;
      const price = priceMap.get(asset.underlyingTicker);

      if (!price || price <= 0) {
        failed.push(asset.underlyingTicker);
        continue;
      }

      await db.marketPriceCache.upsert({
        where: { ticker: asset.underlyingTicker },
        create: {
          ticker: asset.underlyingTicker,
          price,
          currency: "USD",
          fetchedAt: new Date(),
        },
        update: {
          price,
          fetchedAt: new Date(),
        },
      });
      updated++;
    }

    revalidatePath("/");
    revalidatePath("/assets");

    return { success: true, updated, failed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al obtener precios.";
    return { success: false, error: message };
  }
}

export async function getMarketPrices(): Promise<MarketPriceRow[]> {
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
        fetchedAt: cached.fetchedAt,
      };
    });
}
