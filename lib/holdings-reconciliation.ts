import { ratioFactor, type RatioChange } from "@/lib/ratio-changes";

export type HoldingMismatch = {
  ticker: string;
  // Cantidad en la tenencia de Cocos (CSV del snapshot).
  holding: number;
  // Lo que suman las transacciones hasta la fecha, en CEDEARs del ratio de esa fecha.
  ledger: number;
  // holding / ledger cuando es un múltiplo exacto (×2, ×3, ÷2…): un cambio de
  // ratio que todavía no se registró en Assets. null si no parece un split.
  likelySplitFactor: number | null;
};

const QTY_EPS = 1e-6;

function splitFactor(holding: number, ledger: number): number | null {
  if (holding <= QTY_EPS || ledger <= QTY_EPS) return null;
  const f = holding / ledger;
  const near = (x: number) => Math.round(x) >= 2 && Math.abs(x - Math.round(x)) < 0.01;
  if (near(f)) return Math.round(f);
  if (near(1 / f)) return 1 / Math.round(1 / f);
  return null;
}

// Compara la tenencia de un snapshot con el libro de transacciones. Cocos no deja
// movimiento cuando acredita CEDEARs por un cambio de ratio (ADR-0023), así que
// una diferencia avisa de un split sin registrar o de movimientos sin importar.
// Solo se revisan los `tickers` dados (los CEDEARs: bonos y FCI no pasan por
// Transaction).
export function reconcileHoldings(input: {
  holdings: { ticker: string; quantity: number }[];
  trades: { ticker: string; type: "BUY" | "SELL"; date: Date; quantity: number }[];
  changes: RatioChange[];
  asOf: Date;
  tickers: Set<string>;
}): HoldingMismatch[] {
  const { changes, asOf, tickers } = input;

  // En CEDEARs del ratio actual, como el resto de los lectores de Transaction.
  const ledgerToday = new Map<string, number>();
  for (const t of input.trades) {
    if (!tickers.has(t.ticker) || t.date.getTime() > asOf.getTime()) continue;
    const qty = Math.abs(t.quantity) * ratioFactor(changes, t.ticker, t.date);
    ledgerToday.set(t.ticker, (ledgerToday.get(t.ticker) ?? 0) + (t.type === "BUY" ? qty : -qty));
  }

  const holdingByTicker = new Map<string, number>();
  for (const h of input.holdings) {
    if (tickers.has(h.ticker)) holdingByTicker.set(h.ticker, (holdingByTicker.get(h.ticker) ?? 0) + h.quantity);
  }

  const mismatches: HoldingMismatch[] = [];
  for (const ticker of new Set([...holdingByTicker.keys(), ...ledgerToday.keys()])) {
    const holding = holdingByTicker.get(ticker) ?? 0;
    // De vuelta a CEDEARs del ratio vigente en la fecha del snapshot.
    const ledger = Math.max(0, (ledgerToday.get(ticker) ?? 0) / ratioFactor(changes, ticker, asOf));
    if (Math.abs(holding - ledger) <= QTY_EPS) continue;
    mismatches.push({ ticker, holding, ledger, likelySplitFactor: splitFactor(holding, ledger) });
  }

  return mismatches.sort((a, b) => a.ticker.localeCompare(b.ticker));
}
