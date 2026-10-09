// Ingreso por dividendos estimado del portfolio actual, en USD.
// Usa el dividendo anual por acción del subyacente (Yahoo: forward o, si no hay,
// el de los últimos 12 meses) y las acciones equivalentes de cada CEDEAR.
// Es una estimación: el emisor puede cambiar el dividendo y la retención real
// depende del país del subyacente.

// Retención en origen supuesta: la de EE.UU. a no residentes (30 %). Es la
// mayoría de los subyacentes y deja la estimación del lado conservador.
export const DIVIDEND_WITHHOLDING = 0.3;

export type DividendHolding = {
  ticker: string;
  quantity: number;
  cedearRatio: number;
  priceUsd: number;
  // Dividendo anual por acción del subyacente; null si no hay dato.
  dividendRateUsd: number | null;
};

export type DividendRow = {
  ticker: string;
  annualGrossUsd: number;
  valueUsd: number;
  // Rendimiento por dividendo del subyacente, en %.
  yieldPct: number;
};

export type DividendProjection = {
  rows: DividendRow[];
  annualGrossUsd: number;
  annualNetUsd: number;
  monthlyNetUsd: number;
  // Rendimiento bruto sobre las posiciones con dato (pagan o no), en %.
  yieldPct: number;
  coveredValueUsd: number;
  // Posiciones sin dato de dividendo: no entran en el cálculo.
  missing: string[];
};

export function projectDividends(holdings: DividendHolding[]): DividendProjection {
  const rows: DividendRow[] = [];
  const missing: string[] = [];
  let coveredValueUsd = 0;

  for (const h of holdings) {
    if (h.dividendRateUsd === null || h.cedearRatio <= 0 || h.priceUsd <= 0 || h.quantity <= 0) {
      missing.push(h.ticker);
      continue;
    }
    const shares = h.quantity / h.cedearRatio;
    const valueUsd = shares * h.priceUsd;
    coveredValueUsd += valueUsd;
    if (h.dividendRateUsd <= 0) continue;
    rows.push({
      ticker: h.ticker,
      annualGrossUsd: shares * h.dividendRateUsd,
      valueUsd,
      yieldPct: (h.dividendRateUsd / h.priceUsd) * 100,
    });
  }

  rows.sort((a, b) => b.annualGrossUsd - a.annualGrossUsd);
  const annualGrossUsd = rows.reduce((s, r) => s + r.annualGrossUsd, 0);
  const annualNetUsd = annualGrossUsd * (1 - DIVIDEND_WITHHOLDING);

  return {
    rows,
    annualGrossUsd,
    annualNetUsd,
    monthlyNetUsd: annualNetUsd / 12,
    yieldPct: coveredValueUsd > 0 ? (annualGrossUsd / coveredValueUsd) * 100 : 0,
    coveredValueUsd,
    missing,
  };
}

// Capital que haría falta para cubrir un gasto mensual solo con dividendos
// netos, con el rendimiento dado (en %). null si el rendimiento es 0.
export function capitalForDividendIncome(monthlyUsd: number, yieldPct: number): number | null {
  const netYield = (yieldPct / 100) * (1 - DIVIDEND_WITHHOLDING);
  if (netYield <= 0) return null;
  return (monthlyUsd * 12) / netYield;
}
