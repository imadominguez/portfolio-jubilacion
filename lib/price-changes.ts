import { ratioFactor, type RatioChange } from "@/lib/ratio-changes";

export type PricePosition = { ticker: string; price: number };

export type PriceChange = {
  ticker: string;
  pricePct: number;
  currentPrice: number;
};

// Variación del precio del CEDEAR entre dos snapshots. Si hubo un cambio de
// ratio en el medio (ADR-0023), el precio anterior se pasa a CEDEARs de hoy: un
// split 20:1 → 60:1 divide el precio por 3 y, sin el ajuste, se leía como una
// caída del 66 %. Solo entran las posiciones con precio en los dos snapshots.
export function priceChangesBetween(
  current: PricePosition[],
  previous: PricePosition[],
  previousDate: Date,
  currentDate: Date,
  changes: RatioChange[]
): PriceChange[] {
  const prevPrice = new Map(previous.map((p) => [p.ticker, p.price]));
  return current.flatMap((p) => {
    const prev = prevPrice.get(p.ticker);
    if (!prev || prev <= 0 || p.price <= 0) return [];
    // Factor de los cambios entre las dos fechas: los posteriores a currentDate
    // afectan a ambos precios por igual y se cancelan.
    const factor = ratioFactor(changes, p.ticker, previousDate) / ratioFactor(changes, p.ticker, currentDate);
    const adjustedPrev = prev / factor;
    return [{ ticker: p.ticker, pricePct: ((p.price - adjustedPrev) / adjustedPrev) * 100, currentPrice: p.price }];
  });
}
