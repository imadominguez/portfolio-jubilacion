export type RatioChange = {
  ticker: string;
  // Primer día con el ratio nuevo (UTC medianoche, como las columnas @db.Date).
  effectiveDate: Date;
  oldRatio: number;
  newRatio: number;
};

// Cuántos CEDEARs de hoy equivale uno operado en `date`: el producto de
// nuevo/viejo de cada cambio de ratio posterior a esa fecha.
export function ratioFactor(changes: RatioChange[], ticker: string, date: Date): number {
  let factor = 1;
  for (const c of changes) {
    if (c.ticker === ticker && date.getTime() < c.effectiveDate.getTime() && c.oldRatio > 0 && c.newRatio > 0) {
      factor *= c.newRatio / c.oldRatio;
    }
  }
  return factor;
}

// Expresa una operación en CEDEARs del ratio actual. Cocos acredita los CEDEARs
// del split sin movimiento: sin este ajuste, el PPM y los lotes cuentan menos
// unidades de las que hay en la tenencia. El monto operado no cambia.
export function adjustForRatioChanges<T extends { ticker: string; date: Date; quantity: number; price: number }>(
  trade: T,
  changes: RatioChange[]
): T {
  const factor = ratioFactor(changes, trade.ticker, trade.date);
  if (factor === 1) return trade;
  return { ...trade, quantity: trade.quantity * factor, price: trade.price / factor };
}
