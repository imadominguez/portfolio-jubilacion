// Señales de precio y selección de noticias para el reporte de oportunidades
// (puro, sin Prisma). La app calcula estas métricas sin IA: Claude solo recibe
// el resultado compacto y aporta el juicio (ADR-0018).

import { pctChange } from "@/lib/snapshot-returns";

export type PricePoint = { date: Date; close: number };

export type PriceSignals = {
  lastClose: number;
  lastDate: Date;
  change1mPct: number | null;
  change3mPct: number | null;
  change1yPct: number | null;
  high52w: number;
  low52w: number;
  // Negativo: cuánto está por debajo del máximo de 52 semanas.
  fromHigh52wPct: number;
  // Positivo: cuánto está por encima del mínimo de 52 semanas.
  fromLow52wPct: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Último cierre en o antes de `target`.
function closeAtOrBefore(sorted: PricePoint[], target: number): number | null {
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].date.getTime() <= target) return sorted[i].close;
  }
  return null;
}

export function priceSignals(history: PricePoint[]): PriceSignals | null {
  const sorted = history
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (sorted.length === 0) return null;

  const last = sorted[sorted.length - 1];
  const lastTime = last.date.getTime();
  const window52w = sorted.filter((p) => p.date.getTime() >= lastTime - 365 * DAY_MS);
  const closes = window52w.map((p) => p.close);
  const high52w = Math.max(...closes);
  const low52w = Math.min(...closes);

  const changeSince = (days: number) => {
    const base = closeAtOrBefore(sorted, lastTime - days * DAY_MS);
    return base === null ? null : pctChange(last.close, base);
  };

  return {
    lastClose: last.close,
    lastDate: last.date,
    change1mPct: changeSince(30),
    change3mPct: changeSince(91),
    change1yPct: changeSince(365),
    high52w,
    low52w,
    fromHigh52wPct: ((last.close - high52w) / high52w) * 100,
    fromLow52wPct: ((last.close - low52w) / low52w) * 100,
  };
}

export type NewsItem = {
  title: string;
  publisher: string;
  publishedAt: Date;
  relatedTickers: string[];
};

// Primera palabra significativa del nombre de la empresa ("MICROSOFT CORP" →
// "microsoft"), para reconocer titulares que la nombran sin el ticker.
function companyKeyword(companyName: string | null | undefined): string | null {
  if (!companyName) return null;
  const word = companyName
    .replace(/^CEDEAR\s+/i, "")
    .split(/[^A-Za-zÀ-ÿ]+/)
    .find((w) => w.length >= 4);
  return word ? word.toLowerCase() : null;
}

// La búsqueda de Yahoo devuelve notas de otras empresas que solo mencionan al
// ticker de pasada. Se queda con las que lo tienen como ticker principal o lo
// nombran (ticker o empresa) en el título, recientes y sin duplicados.
export function selectNews(
  items: NewsItem[],
  ticker: string,
  options: { companyName?: string | null; max?: number; maxAgeDays?: number; now?: Date } = {}
): NewsItem[] {
  const { companyName, max = 5, maxAgeDays = 30, now = new Date() } = options;
  const symbol = ticker.toUpperCase();
  const tickerRe = new RegExp(`\\b${symbol.replace(/[^A-Z0-9]/g, "")}\\b`);
  const keyword = companyKeyword(companyName);
  const minTime = now.getTime() - maxAgeDays * DAY_MS;
  const seen = new Set<string>();

  return items
    .filter((n) => n.publishedAt.getTime() >= minTime)
    .filter((n) => {
      const primary = n.relatedTickers[0]?.toUpperCase() === symbol;
      const mentionsTicker = tickerRe.test(n.title.toUpperCase());
      const mentionsCompany = keyword !== null && n.title.toLowerCase().includes(keyword);
      return primary || mentionsTicker || mentionsCompany;
    })
    .filter((n) => {
      const key = n.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, max);
}
