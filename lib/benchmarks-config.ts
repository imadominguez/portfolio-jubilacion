// Benchmarks de mercado (Yahoo Finance).
export const BENCHMARKS = {
  sp500: { id: "sp500", label: "S&P 500", ticker: "^GSPC" },
  merval: { id: "merval", label: "Merval", ticker: "^MERV" },
  nasdaq: { id: "nasdaq", label: "NASDAQ", ticker: "^IXIC" },
} as const;

export type BenchmarkId = keyof typeof BENCHMARKS;

// Índices macro de Argentina (argentinadatos.com).
// - inflacion: IPC mensual (%) → se guarda como índice acumulado base 100.
// - cer: UVA diaria (proxy del CER) → ya es un índice, se guarda directo.
export const INDEX_BENCHMARKS = {
  inflacion: {
    id: "inflacion",
    label: "Inflación (IPC)",
    path: "/v1/finanzas/indices/inflacion",
    kind: "monthly-rate",
  },
  cer: {
    id: "cer",
    label: "CER (UVA)",
    path: "/v1/finanzas/indices/uva",
    kind: "index",
  },
} as const;

export type IndexBenchmarkId = keyof typeof INDEX_BENCHMARKS;
export type AnyBenchmarkId = BenchmarkId | IndexBenchmarkId;
