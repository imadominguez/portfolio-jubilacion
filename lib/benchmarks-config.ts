export const BENCHMARKS = {
  sp500: { id: "sp500", label: "S&P 500", ticker: "^GSPC" },
  merval: { id: "merval", label: "Merval", ticker: "^MERV" },
  nasdaq: { id: "nasdaq", label: "NASDAQ", ticker: "^IXIC" },
} as const;

export type BenchmarkId = keyof typeof BENCHMARKS;
