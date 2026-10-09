// ---------------------------------------------------------------------------
// Tags del caché de datos (`'use cache'` + `cacheTag`), ADR-0017.
//
// Cada función cacheada declara un tag por cada dominio que lee, y cada
// mutación invalida solo el tag del dominio que escribió (`lib/revalidate.ts`).
// Así no hace falta saber qué pantallas consumen qué datos.
//
// Los datos del usuario llevan el `userId` en el tag (nunca emails ni tokens);
// los datos de mercado son globales.
// ---------------------------------------------------------------------------

export const userTags = {
  snapshots: (userId: string) => `snapshots:${userId}`,
  trades: (userId: string) => `trades:${userId}`,
  dividends: (userId: string) => `dividends:${userId}`,
  milestones: (userId: string) => `milestones:${userId}`,
  retirement: (userId: string) => `retirement:${userId}`,
  rebalance: (userId: string) => `rebalance:${userId}`,
  setup: (userId: string) => `setup:${userId}`,
  alerts: (userId: string) => `alerts:${userId}`,
  expenses: (userId: string) => `expenses:${userId}`,
} as const;

export const marketTags = {
  assets: "assets",
  ccl: "ccl",
  marketPrices: "market-prices",
  historicalPrices: "historical-prices",
  benchmarks: "benchmarks",
  strategy: "strategy",
} as const;
