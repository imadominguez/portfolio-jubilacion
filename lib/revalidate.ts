import { updateTag } from "next/cache";
import { marketTags, userTags } from "@/lib/cache-tags";

// ---------------------------------------------------------------------------
// Invalidación centralizada del caché de datos (ADR-0017).
//
// Las lecturas se cachean con `'use cache'` + `cacheTag` por dominio
// (`lib/cache-tags.ts`). Cada helper expira el tag del dominio que escribió
// la mutación; las funciones cacheadas que dependen de varios dominios
// declaran todos sus tags, así que no hace falta listar pantallas.
//
// `updateTag` solo funciona en Server Actions: la siguiente lectura espera
// datos frescos (read-your-own-writes), incluso dentro de la misma action, y
// además vacía el caché del router en el cliente. En un Route Handler usar
// `revalidateTag(tag, "max")`.
// ---------------------------------------------------------------------------

// Snapshots y posiciones.
export function revalidatePortfolioData(userId: string): void {
  updateTag(userTags.snapshots(userId));
}

// Transacciones y movimientos (PPM, P&L, costo de ganancia real).
export function revalidateTrades(userId: string): void {
  updateTag(userTags.trades(userId));
}

export function revalidateDividends(userId: string): void {
  updateTag(userTags.dividends(userId));
}

// Catálogo de assets (ratio, subyacente, sector/país).
export function revalidateAssets(): void {
  updateTag(marketTags.assets);
}

// CCL (ExchangeRate).
export function revalidateCcl(): void {
  updateTag(marketTags.ccl);
}

// Precios de mercado actuales (MarketPriceCache).
export function revalidateMarketPrices(): void {
  updateTag(marketTags.marketPrices);
}

// Precios históricos de subyacentes (HistoricalPriceCache).
export function revalidateHistoricalPrices(): void {
  updateTag(marketTags.historicalPrices);
}

// Benchmarks históricos e índices macro (IPC/CER).
export function revalidateBenchmarks(): void {
  updateTag(marketTags.benchmarks);
}

export function revalidateMilestones(userId: string): void {
  updateTag(userTags.milestones(userId));
}

export function revalidateRetirement(userId: string): void {
  updateTag(userTags.retirement(userId));
}

// Configuración e historial de alertas por mail.
export function revalidateAlerts(userId: string): void {
  updateTag(userTags.alerts(userId));
}

// Categorías y notas de los gastos (ExpenseTag).
export function revalidateExpenses(userId: string): void {
  updateTag(userTags.expenses(userId));
}

// Estado de onboarding (UserSetup).
export function revalidateSetup(userId: string): void {
  updateTag(userTags.setup(userId));
}

export function revalidateStrategy(): void {
  updateTag(marketTags.strategy);
}
