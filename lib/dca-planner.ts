// Planificador DCA determinista (sin IA).
//
// Dado un aporte mensual, reparte el capital entre las posiciones del objetivo
// (TargetAllocation) priorizando las más infraponderadas, sin asignar capital a
// posiciones que ya alcanzaron su peso objetivo.
//
// Reglas (ver skill de inversión):
//  - Sólo reciben aportes los tickers del objetivo (targetPct > 0).
//  - Cada ticker tiene un techo: no se compra más de lo que falta para llegar
//    a su peso objetivo (gap). Si sobra capital, se reparte entre el resto.

export type DcaTarget = { ticker: string; targetPct: number };

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
  targets: DcaTarget[];
  assets: DcaAssetInfo[];
  // Precio USD del subyacente por ticker subyacente (ej: { MSFT: 480 }).
  marketPrices: Record<string, number>;
};

export type DcaRow = {
  ticker: string;
  targetPct: number;
  currentPct: number;
  currentValue: number;
  gapArs: number;
  amountArs: number;
  newPct: number;
  cedearPriceArs: number | null;
  estimatedCedears: number | null;
};

export type DcaPlan = {
  rows: DcaRow[];
  totalAllocatedArs: number;
  unallocatedArs: number;
};

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
  const { monthlyAmountArs, portfolioValueArs, ccl, positions, targets, assets, marketPrices } =
    input;

  const posMap = new Map(positions.map((p) => [p.ticker, p]));
  const assetMap = new Map(assets.map((a) => [a.ticker, a]));

  const rows: DcaRow[] = targets
    .filter((t) => t.targetPct > 0)
    .map((t) => {
      const pos = posMap.get(t.ticker);
      const currentValue = pos?.currentValue ?? 0;
      const currentPct = pos?.currentPct ?? 0;
      const idealValue = (t.targetPct / 100) * portfolioValueArs;
      const gapArs = Math.max(0, idealValue - currentValue);

      const asset = assetMap.get(t.ticker);
      const cedearPriceArs = estimateCedearPriceArs(
        asset,
        pos?.currentPrice,
        marketPrices,
        ccl
      );

      return {
        ticker: t.ticker,
        targetPct: t.targetPct,
        currentPct,
        currentValue,
        gapArs,
        amountArs: 0,
        newPct: currentPct,
        cedearPriceArs,
        estimatedCedears: null,
      };
    });

  // Water-filling: reparte proporcional al gap restante, respetando el techo.
  const active = rows.filter((r) => r.gapArs > 0);
  let remaining = Math.max(0, monthlyAmountArs);
  let guard = 0;

  while (remaining > 0.5 && guard++ < 100) {
    const totalRoom = active.reduce((s, r) => s + (r.gapArs - r.amountArs), 0);
    if (totalRoom <= 0) break;

    let distributed = 0;
    for (const r of active) {
      const room = r.gapArs - r.amountArs;
      if (room <= 0) continue;
      const share = remaining * (room / totalRoom);
      const add = Math.min(share, room);
      r.amountArs += add;
      distributed += add;
    }
    if (distributed <= 0) break;
    remaining -= distributed;
  }

  const totalAfter = portfolioValueArs + monthlyAmountArs;
  for (const r of rows) {
    r.amountArs = Math.round(r.amountArs);
    r.newPct = totalAfter > 0 ? ((r.currentValue + r.amountArs) / totalAfter) * 100 : r.currentPct;
    r.estimatedCedears =
      r.cedearPriceArs && r.cedearPriceArs > 0
        ? Math.floor(r.amountArs / r.cedearPriceArs)
        : null;
  }

  const totalAllocatedArs = rows.reduce((s, r) => s + r.amountArs, 0);

  return {
    rows: rows.sort((a, b) => b.amountArs - a.amountArs || a.ticker.localeCompare(b.ticker)),
    totalAllocatedArs,
    unallocatedArs: Math.max(0, Math.round(monthlyAmountArs) - totalAllocatedArs),
  };
}
