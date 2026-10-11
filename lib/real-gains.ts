import { tradeGrossAmount } from "@/lib/trade-amount";

export type CostTrade = {
  ticker: string;
  type: "BUY" | "SELL";
  date: Date;
  // En CEDEARs del ratio actual (ya pasada por adjustForRatioChanges).
  quantity: number;
  price: number;
  currency: "ARS" | "USD";
  fee: number | null;
  movementGross: number | null;
};

export type TickerCost = {
  costArs: number;
  costUsdCcl: number | null; // Método A: cada compra al CCL de su fecha
  costUsdStock: number | null; // Método B: acciones subyacentes al precio de la fecha
  totalQty: number;
  cclApproximate: boolean;
  stockPriceAvailable: boolean;
  cclHits: number;
  cclMisses: number;
};

export type CostLookups = {
  // CCL de la fecha o de una cercana; `exact` = mismo día.
  cclNear: (date: Date) => { value: number; exact: boolean } | null;
  // Precio USD del subyacente cerca de la fecha, por ticker del CEDEAR.
  stockPriceNear: (ticker: string, date: Date) => number | null;
  // Ratio actual del CEDEAR (las cantidades ya vienen en CEDEARs de hoy).
  cedearRatio: (ticker: string) => number | null;
};

// Costo de la tenencia por ticker, en ARS y en los dos USD de la ganancia real.
// Las compras en dólares (Dolar MEP) se pasan a pesos al CCL de su fecha y, en
// el método A, cuentan por lo que costaron en USD. Las ventas descargan costo a
// costo promedio, como el PPM: sin eso, una venta parcial dejaba el costo de
// todas las compras contra el valor de lo que quedó. Un ticker con una compra
// en USD sin CCL se omite (no se puede expresar su costo en pesos).
export function costBasisByTicker(trades: CostTrade[], lookups: CostLookups): Map<string, TickerCost> {
  const byTicker = new Map<string, TickerCost>();
  const unconvertible = new Set<string>();

  const sorted = [...trades].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || (a.type === b.type ? 0 : a.type === "BUY" ? -1 : 1)
  );

  for (const t of sorted) {
    const qty = Math.abs(t.quantity);
    const entry = byTicker.get(t.ticker);

    if (t.type === "SELL") {
      if (!entry || entry.totalQty <= 0) continue;
      const remaining = Math.max(0, entry.totalQty - qty);
      const keep = remaining / entry.totalQty;
      entry.costArs *= keep;
      if (entry.costUsdCcl !== null) entry.costUsdCcl *= keep;
      if (entry.costUsdStock !== null) entry.costUsdStock *= keep;
      entry.totalQty = remaining;
      continue;
    }

    const gross = tradeGrossAmount({ quantity: qty, price: t.price, movementGross: t.movementGross }) + (t.fee ?? 0);
    const ccl = lookups.cclNear(t.date);

    let costArs: number;
    let costUsdCcl: number | null;
    if (t.currency === "USD") {
      if (!ccl) {
        unconvertible.add(t.ticker);
        continue;
      }
      costArs = gross * ccl.value;
      costUsdCcl = gross;
    } else {
      costArs = gross;
      costUsdCcl = ccl ? gross / ccl.value : null;
    }

    const ratio = lookups.cedearRatio(t.ticker);
    const stockPrice = ratio && ratio > 0 ? lookups.stockPriceNear(t.ticker, t.date) : null;
    const costUsdStock = stockPrice !== null && ratio ? (qty / ratio) * stockPrice : null;

    if (entry) {
      entry.costArs += costArs;
      entry.costUsdCcl =
        entry.costUsdCcl !== null && costUsdCcl !== null ? entry.costUsdCcl + costUsdCcl : entry.costUsdCcl ?? costUsdCcl;
      entry.costUsdStock =
        entry.costUsdStock !== null && costUsdStock !== null
          ? entry.costUsdStock + costUsdStock
          : entry.costUsdStock ?? costUsdStock;
      entry.totalQty += qty;
      if (ccl) entry.cclHits++;
      else entry.cclMisses++;
      if (costUsdStock === null) entry.stockPriceAvailable = false;
    } else {
      byTicker.set(t.ticker, {
        costArs,
        costUsdCcl,
        costUsdStock,
        totalQty: qty,
        cclApproximate: ccl ? !ccl.exact : true,
        stockPriceAvailable: costUsdStock !== null,
        cclHits: ccl ? 1 : 0,
        cclMisses: ccl ? 0 : 1,
      });
    }
  }

  for (const ticker of unconvertible) byTicker.delete(ticker);
  return byTicker;
}
