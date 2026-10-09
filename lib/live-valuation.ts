// Valuación "hoy" de la tenencia del último snapshot: mismas cantidades, con el
// precio del subyacente en USD que se actualiza a diario (MarketPriceCache) y el
// último CCL guardado. Las posiciones sin subyacente (bonos, ONs, FCI) quedan
// con su valor del snapshot. Es una estimación: el precio en pesos del CEDEAR no
// es exactamente subyacente / ratio × CCL.

export type LiveValuationPosition = {
  ticker: string;
  quantity: number;
  // Precio y valor en ARS del snapshot.
  price: number;
  positionValue: number;
};

export type LiveValuationPrice = {
  ticker: string;
  priceUsd: number;
  cedearRatio: number;
  fetchedAt: Date;
};

export type LiveValuation = {
  valueArs: number;
  valueUsd: number;
  // P&L no realizado contra el PPM en pesos; null si no hay PPM de ninguna posición.
  unrealizedPnlArs: number | null;
  // Posiciones valuadas con el precio del día (el resto, con el del snapshot).
  pricedCount: number;
  // Precio más viejo de los usados.
  pricesAsOf: Date | null;
  ccl: number;
};

export function liveValuation(input: {
  positions: LiveValuationPosition[];
  prices: LiveValuationPrice[];
  ppm: { ticker: string; avgPrice: number }[];
  snapshotCcl: number;
  // Último CCL guardado; si no hay, el del snapshot.
  currentCcl: number | null;
}): LiveValuation | null {
  const { positions, snapshotCcl } = input;
  if (!(snapshotCcl > 0)) return null;
  const ccl = input.currentCcl && input.currentCcl > 0 ? input.currentCcl : snapshotCcl;
  const priceByTicker = new Map(input.prices.map((p) => [p.ticker, p]));
  const ppmByTicker = new Map(input.ppm.filter((p) => p.avgPrice > 0).map((p) => [p.ticker, p.avgPrice]));

  let valueArs = 0;
  let valueUsd = 0;
  let pnl = 0;
  let hasPnl = false;
  let pricedCount = 0;
  let pricesAsOf: Date | null = null;

  for (const pos of positions) {
    const market = priceByTicker.get(pos.ticker);
    let priceArs = pos.price;
    if (market && market.priceUsd > 0 && market.cedearRatio > 0) {
      const usd = (pos.quantity / market.cedearRatio) * market.priceUsd;
      valueUsd += usd;
      valueArs += usd * ccl;
      priceArs = (market.priceUsd / market.cedearRatio) * ccl;
      pricedCount++;
      if (!pricesAsOf || market.fetchedAt < pricesAsOf) pricesAsOf = market.fetchedAt;
    } else {
      // Sin precio del día: el valor del snapshot, en USD con el CCL del snapshot.
      valueArs += pos.positionValue;
      valueUsd += pos.positionValue / snapshotCcl;
    }
    const avg = ppmByTicker.get(pos.ticker);
    if (avg !== undefined) {
      pnl += (priceArs - avg) * pos.quantity;
      hasPnl = true;
    }
  }

  if (pricedCount === 0) return null;
  return { valueArs, valueUsd, unrealizedPnlArs: hasPnl ? pnl : null, pricedCount, pricesAsOf, ccl };
}
