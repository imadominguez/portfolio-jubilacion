import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Revalidación centralizada de rutas.
//
// La app no usa caché de datos de Next (ni `unstable_cache` ni `"use cache"`):
// todas las lecturas van a Prisma en cada render y las páginas de `(app)` son
// dinámicas. Igual, cada mutación invalida explícitamente las rutas que
// consumen los datos afectados, para no depender del comportamiento por
// defecto del caché y mantener el contrato correcto si se agrega caché.
// ---------------------------------------------------------------------------

const PATHS = {
  dashboard: "/",
  snapshots: "/snapshots",
  performance: "/performance",
  ccl: "/ccl",
  analysis: "/analysis",
  rebalance: "/rebalance",
  retirement: "/retirement",
  settings: "/settings",
  realGains: "/real-gains",
  transactions: "/transactions",
  assets: "/assets",
  strategy: "/strategy",
  dataHub: "/datos",
} as const;

function revalidate(paths: readonly string[]): void {
  for (const path of paths) revalidatePath(path);
}

// Snapshots y todo lo que deriva de posiciones/fechas.
// Afecta: dashboard, snapshots, performance, CCL (overlay), análisis,
// rebalanceo, retiro (CAGR), hitos (último snapshot) y ganancia real.
export function revalidatePortfolioData(): void {
  revalidate([
    PATHS.dashboard,
    PATHS.snapshots,
    PATHS.performance,
    PATHS.ccl,
    PATHS.analysis,
    PATHS.rebalance,
    PATHS.retirement,
    PATHS.settings,
    PATHS.realGains,
    PATHS.dataHub,
  ]);
}

// Transacciones y movimientos (PPM, P&L, costo de ganancia real).
export function revalidateTrades(): void {
  revalidate([PATHS.dashboard, PATHS.transactions, PATHS.realGains, PATHS.dataHub]);
}

// Dividendos (KPI del dashboard + listado en transacciones).
export function revalidateDividends(): void {
  revalidate([PATHS.dashboard, PATHS.transactions]);
}

// Catálogo de assets (ratio, subyacente, sector/país): afecta concentración,
// valor USD en vivo y ganancia real.
export function revalidateAssets(): void {
  revalidate([
    PATHS.assets,
    PATHS.dashboard,
    PATHS.analysis,
    PATHS.realGains,
    PATHS.dataHub,
  ]);
}

// CCL (ExchangeRate): página de historial y ganancia real (CCL histórico).
export function revalidateCcl(): void {
  revalidate([PATHS.ccl, PATHS.realGains, PATHS.dataHub]);
}

// Precios de mercado actuales (MarketPriceCache): valor USD en vivo y
// valor actual del subyacente en ganancia real.
export function revalidateMarketPrices(): void {
  revalidate([PATHS.dashboard, PATHS.realGains, PATHS.dataHub]);
}

// Precios históricos de subyacentes (HistoricalPriceCache): sólo ganancia real.
export function revalidateHistoricalPrices(): void {
  revalidate([PATHS.realGains, PATHS.dataHub]);
}

// Benchmarks históricos e índices macro (IPC/CER).
export function revalidateBenchmarks(): void {
  revalidate([PATHS.performance, PATHS.dataHub]);
}

// Asignación objetivo de rebalanceo (página + alertas del dashboard).
export function revalidateRebalance(): void {
  revalidate([PATHS.rebalance, PATHS.dashboard, PATHS.dataHub]);
}

// Hitos (página de configuración + widget del dashboard).
export function revalidateMilestones(): void {
  revalidate([PATHS.settings, PATHS.dashboard, PATHS.dataHub]);
}

// Configuración de retiro (calculadora + tarjeta del dashboard).
export function revalidateRetirement(): void {
  revalidate([PATHS.retirement, PATHS.dashboard, PATHS.dataHub]);
}

// Estado de onboarding/setup (wizard + checklist del dashboard y hub de datos).
export function revalidateSetup(): void {
  revalidate([PATHS.dashboard, PATHS.dataHub]);
}

// Estrategia de inversión.
export function revalidateStrategy(): void {
  revalidate([PATHS.strategy]);
}
