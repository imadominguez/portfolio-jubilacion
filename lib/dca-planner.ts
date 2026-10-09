// Planificador del aporte mensual (puro, sin Prisma). ADR-0022 (reemplaza a
// ADR-0013): sin pesos objetivo ni topes por acción; el reparto sigue las
// señales del último reporte de oportunidades.
//
//  - Solo entran las acciones del último snapshot con subyacente (CEDEARs): el
//    FCI y las acciones locales no tienen señal.
//  - Con reporte: el aporte va a las marcadas "compra", ponderado por
//    confianza (alta 3, media 2, baja 1). Si ninguna es "compra", se reparte en
//    partes iguales entre las "mantener". "Venta" nunca recibe.
//  - Sin reporte: partes iguales entre todas.

export type DcaSignal = {
  senal: "compra" | "mantener" | "venta";
  confianza: "alta" | "media" | "baja";
};

export type DcaPosition = {
  ticker: string;
  currentPct: number;
  currentValue: number;
  currentPrice?: number | null;
};

export type DcaAssetInfo = {
  ticker: string;
  cedearRatio: number | null;
  underlyingTicker: string | null;
};

export type DcaInput = {
  monthlyAmountArs: number;
  portfolioValueArs: number;
  ccl: number | null;
  positions: DcaPosition[];
  assets: DcaAssetInfo[];
  // Precio USD del subyacente por ticker subyacente (ej: { MSFT: 480 }).
  marketPrices: Record<string, number>;
  // Señal por ticker del último reporte; null si no hay reporte.
  signals: Record<string, DcaSignal> | null;
};

// Qué regla se aplicó: "compra" (hay compras), "mantener" (ninguna compra),
// "ninguna" (todo es venta o no hay señales para estas acciones), "iguales"
// (sin reporte).
export type DcaMode = "compra" | "mantener" | "ninguna" | "iguales";

export type DcaRow = {
  ticker: string;
  signal: DcaSignal | null;
  currentPct: number;
  currentValue: number;
  // Peso en el reparto (0 = no recibe).
  weight: number;
  amountArs: number;
  newPct: number;
  cedearPriceArs: number | null;
  estimatedCedears: number | null;
};

export type DcaPlan = {
  mode: DcaMode;
  rows: DcaRow[];
  totalAllocatedArs: number;
  unallocatedArs: number;
};

export const CONFIDENCE_WEIGHT: Record<DcaSignal["confianza"], number> = { alta: 3, media: 2, baja: 1 };

function estimateCedearPriceArs(
  asset: DcaAssetInfo | undefined,
  currentPrice: number | null | undefined,
  marketPrices: Record<string, number>,
  ccl: number | null
): number | null {
  if (currentPrice && currentPrice > 0) return currentPrice;
  if (!asset?.underlyingTicker || !asset.cedearRatio || asset.cedearRatio <= 0) return null;
  const underlyingUsd = marketPrices[asset.underlyingTicker];
  if (!underlyingUsd || underlyingUsd <= 0 || !ccl || ccl <= 0) return null;
  return (underlyingUsd / Number(asset.cedearRatio)) * ccl;
}

export function planDca(input: DcaInput): DcaPlan {
  const { monthlyAmountArs, portfolioValueArs, ccl, positions, assets, marketPrices, signals } = input;
  const assetMap = new Map(assets.map((a) => [a.ticker, a]));
  const amount = Math.max(0, monthlyAmountArs);

  const rows: DcaRow[] = positions
    .filter((p) => assetMap.get(p.ticker)?.underlyingTicker)
    .map((p) => ({
      ticker: p.ticker,
      signal: signals?.[p.ticker] ?? null,
      currentPct: p.currentPct,
      currentValue: p.currentValue,
      weight: 0,
      amountArs: 0,
      newPct: p.currentPct,
      cedearPriceArs: estimateCedearPriceArs(assetMap.get(p.ticker), p.currentPrice, marketPrices, ccl),
      estimatedCedears: null,
    }));

  let mode: DcaMode;
  if (signals === null) {
    mode = "iguales";
    for (const r of rows) r.weight = 1;
  } else if (rows.some((r) => r.signal?.senal === "compra")) {
    mode = "compra";
    for (const r of rows) if (r.signal?.senal === "compra") r.weight = CONFIDENCE_WEIGHT[r.signal.confianza];
  } else if (rows.some((r) => r.signal?.senal === "mantener")) {
    mode = "mantener";
    for (const r of rows) if (r.signal?.senal === "mantener") r.weight = 1;
  } else {
    mode = "ninguna";
  }

  const totalWeight = rows.reduce((acc, r) => acc + r.weight, 0);
  const totalAfter = portfolioValueArs + amount;
  for (const r of rows) {
    r.amountArs = totalWeight > 0 ? Math.round((amount * r.weight) / totalWeight) : 0;
    r.newPct = totalAfter > 0 ? ((r.currentValue + r.amountArs) / totalAfter) * 100 : r.currentPct;
    r.estimatedCedears = r.cedearPriceArs && r.cedearPriceArs > 0 ? Math.floor(r.amountArs / r.cedearPriceArs) : null;
  }

  const totalAllocatedArs = rows.reduce((s, r) => s + r.amountArs, 0);
  return {
    mode,
    rows: rows.sort((a, b) => b.amountArs - a.amountArs || a.ticker.localeCompare(b.ticker)),
    totalAllocatedArs,
    unallocatedArs: Math.max(0, Math.round(amount) - totalAllocatedArs),
  };
}
