import { tradeGrossAmount } from "@/lib/trade-amount";

export type PpmTrade = {
  ticker: string;
  type: "BUY" | "SELL";
  date: Date;
  quantity: number;
  price: number;
  currency: "ARS" | "USD";
  fee: number | null;
  // Bruto del movimiento de Cocos, en la moneda de la operación.
  movementGross: number | null;
};

export type PpmRow = {
  ticker: string;
  // En ARS: las compras en dólares (Dolar MEP) se pasan al CCL de su fecha.
  avgPrice: number;
  totalQuantity: number;
  totalCost: number;
};

// PPM en pesos por ticker. Sumar compras en USD y en ARS sin convertir daba un
// promedio sin sentido (y los paneles lo descartaban), así que cada operación
// en dólares se pasa al CCL de su fecha. Un ticker con una operación en USD sin
// CCL disponible queda fuera: mejor sin PPM que con uno incorrecto.
export function computePpm(trades: PpmTrade[], cclAt: (date: Date) => number | null): PpmRow[] {
  const byTicker = new Map<string, { totalCost: number; totalQty: number }>();
  const unconvertible = new Set<string>();

  // El mismo día, compras antes que ventas: Cocos registra la entrada y la
  // salida de una operatoria (p. ej. una ON comprada y vendida) con igual fecha.
  const sorted = [...trades].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || (a.type === b.type ? 0 : a.type === "BUY" ? -1 : 1)
  );
  for (const t of sorted) {
    const qty = Math.abs(t.quantity);
    const entry = byTicker.get(t.ticker) ?? { totalCost: 0, totalQty: 0 };
    byTicker.set(t.ticker, entry);

    if (t.type === "BUY") {
      const rate = t.currency === "USD" ? cclAt(t.date) : 1;
      if (!rate) {
        unconvertible.add(t.ticker);
        continue;
      }
      const cost = tradeGrossAmount({ quantity: qty, price: t.price, movementGross: t.movementGross }) + (t.fee ?? 0);
      entry.totalCost += cost * rate;
      entry.totalQty += qty;
    } else {
      // Vender a costo promedio no cambia el PPM: solo descarga costo.
      const ppm = entry.totalQty > 0 ? entry.totalCost / entry.totalQty : 0;
      entry.totalQty = Math.max(0, entry.totalQty - qty);
      entry.totalCost = ppm * entry.totalQty;
    }
  }

  return Array.from(byTicker.entries())
    .filter(([ticker, v]) => v.totalQty > 0 && !unconvertible.has(ticker))
    .map(([ticker, v]) => ({
      ticker,
      avgPrice: v.totalCost / v.totalQty,
      totalQuantity: v.totalQty,
      totalCost: v.totalCost,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}
