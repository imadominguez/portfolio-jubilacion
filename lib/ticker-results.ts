import { adjustForRatioChanges, ratioFactor, type RatioChange } from "@/lib/ratio-changes";

// Resultado de un año por ticker, en pesos y en dólares (puro, sin Prisma).
//
// El período va de snapshot a snapshot: el último del año anterior (o el 1/1 si
// no hay) contra el último del año. Así el valor inicial y el final son los que
// informó Cocos, y en el medio solo cuentan los flujos del libro:
//
//   resultado = valor final − valor inicial − compras + ventas + dividendos
//
// Comparar valores sin descontar compras contaría los aportes como ganancia
// (ADR-0019). El resultado se abre en realizado (ventas contra costo promedio,
// con el costo de compras de años anteriores) y no realizado (el resto, sin los
// dividendos). Cada flujo en dólares usa el CCL de su fecha, nunca el de hoy.

export type Money = { ars: number; usd: number | null };

export type ResultsTrade = {
  date: Date;
  ticker: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  currency: "ARS" | "USD";
  fee: number;
  // Bruto del movimiento de Cocos (bonos y ONs cotizan cada 100 nominales).
  amount: number | null;
  // Liquidación según Cocos. La tenencia del snapshot es la liquidada: una compra
  // del viernes que liquida el martes no figura en el snapshot del lunes.
  settlementDate?: Date | null;
};

export type ResultsSnapshot = {
  date: Date;
  ccl: number | null;
  positions: { ticker: string; quantity: number; currency: "ARS" | "USD"; value: number }[];
};

export type ResultsDividend = { date: Date; ticker: string; currency: "ARS" | "USD"; amount: number };

export type TradeEvent = {
  date: Date;
  type: "BUY" | "SELL";
  // En CEDEARs del ratio actual (ADR-0023).
  quantity: number;
  currency: "ARS" | "USD";
  ccl: number | null;
  // Compras: bruto + comisión (lo que salió). Ventas: bruto − comisión (lo que entró).
  amount: Money;
  unitPrice: Money;
  // Solo ventas: ingreso contra el costo promedio de lo vendido.
  realized: Money | null;
  positionAfter: number;
  avgCostAfter: Money | null;
};

export type PricePoint = { date: Date; unitPrice: Money };

export type TickerResult = {
  ticker: string;
  startQuantity: number;
  endQuantity: number;
  start: Money;
  end: Money;
  bought: Money;
  sold: Money;
  boughtQuantity: number;
  soldQuantity: number;
  dividends: Money;
  realized: Money;
  unrealized: Money;
  total: Money;
  // Resultado sobre lo puesto en el período (valor inicial + compras).
  returnPct: { ars: number | null; usd: number | null };
  events: TradeEvent[];
  // Precio por unidad en cada snapshot del período, para el gráfico.
  prices: PricePoint[];
  // Inicial + compras − ventas no da la tenencia final: faltan movimientos o
  // hay un split sin registrar, y el resultado no es confiable.
  quantityMismatch: { expected: number; actual: number } | null;
  // Había tenencia antes del período pero ningún snapshot que la valúe.
  unvaluedStart: boolean;
};

export type MonthFlows = { month: string; bought: Money; sold: Money };

export type YearResults = {
  year: number;
  start: { date: Date; ccl: number | null } | null;
  end: { date: Date; ccl: number | null };
  tickers: TickerResult[];
  totals: Pick<TickerResult, "start" | "end" | "bought" | "sold" | "dividends" | "realized" | "unrealized" | "total">;
  monthly: MonthFlows[];
  // Operaciones del año posteriores al último snapshot: entran recién con el próximo.
  tradesAfterEnd: number;
};

const QTY_EPS = 1e-4;
const yearOf = (d: Date) => d.getUTCFullYear();
const monthOf = (d: Date) => d.toISOString().slice(0, 7);
const settledOn = (t: { date: Date; settlementDate?: Date | null }) => t.settlementDate ?? t.date;

const zero = (): Money => ({ ars: 0, usd: 0 });
const add = (a: Money, b: Money): Money => ({
  ars: a.ars + b.ars,
  usd: a.usd === null || b.usd === null ? null : a.usd + b.usd,
});
const sub = (a: Money, b: Money): Money => add(a, { ars: -b.ars, usd: b.usd === null ? null : -b.usd });
const scale = (a: Money, k: number): Money => ({ ars: a.ars * k, usd: a.usd === null ? null : a.usd * k });
const ratio = (num: number | null, den: number | null) => (num === null || den === null || den <= 0 ? null : num / den);

// Años que se pueden mostrar: los que tienen un snapshot de cierre.
export function resultYears(snapshots: { date: Date }[]): number[] {
  return [...new Set(snapshots.map((s) => yearOf(s.date)))].sort((a, b) => b - a);
}

export function tickerResults(input: {
  year: number;
  trades: ResultsTrade[];
  snapshots: ResultsSnapshot[];
  dividends: ResultsDividend[];
  cclAt: (date: Date) => number | null;
  changes: RatioChange[];
}): YearResults | null {
  const { year, cclAt, changes } = input;
  const snapshots = [...input.snapshots].sort((a, b) => a.date.getTime() - b.date.getTime());
  const inYear = snapshots.filter((s) => yearOf(s.date) === year);
  if (inYear.length === 0) return null;
  const endSnap = inYear[inYear.length - 1];
  const startSnap = snapshots.filter((s) => yearOf(s.date) < year).at(-1) ?? null;

  // Límite inferior exclusivo del período.
  const from = startSnap ? startSnap.date.getTime() : Date.UTC(year, 0, 1) - 1;
  const to = endSnap.date.getTime();
  const inPeriod = (d: Date) => d.getTime() > from && d.getTime() <= to;

  const snapCcl = (s: ResultsSnapshot) => (s.ccl && s.ccl > 0 ? s.ccl : cclAt(s.date));
  const toMoney = (value: number, currency: "ARS" | "USD", ccl: number | null): Money | null => {
    if (currency === "ARS") return { ars: value, usd: ccl ? value / ccl : null };
    return ccl ? { ars: value * ccl, usd: value } : null;
  };

  // Tenencia de un ticker en un snapshot, en CEDEARs del ratio actual.
  const holdingAt = (s: ResultsSnapshot | null, ticker: string): { qty: number; value: Money } => {
    if (!s) return { qty: 0, value: zero() };
    const ccl = snapCcl(s);
    let qty = 0;
    let value = zero();
    for (const p of s.positions) {
      if (p.ticker !== ticker) continue;
      qty += p.quantity * ratioFactor(changes, ticker, s.date);
      value = add(value, toMoney(p.value, p.currency, ccl) ?? { ars: p.currency === "ARS" ? p.value : 0, usd: null });
    }
    return { qty, value };
  };

  const trades = input.trades.map((t) => adjustForRatioChanges(t, changes));
  const tradedTickers = new Set(trades.map((t) => t.ticker));
  // Solo instrumentos que pasan por el libro de operaciones: sin compras y
  // ventas (FCI, saldos) la variación de valor no se puede separar de los aportes.
  const tickers = new Set<string>();
  for (const s of [startSnap, endSnap]) for (const p of s?.positions ?? []) if (tradedTickers.has(p.ticker)) tickers.add(p.ticker);
  for (const t of trades) if (inPeriod(settledOn(t))) tickers.add(t.ticker);

  const results: TickerResult[] = [];
  const monthly = new Map<string, MonthFlows>();
  let tradesAfterEnd = 0;

  for (const ticker of tickers) {
    const own = trades
      .filter((t) => t.ticker === ticker)
      .sort((a, b) => settledOn(a).getTime() - settledOn(b).getTime() || (a.type === b.type ? 0 : a.type === "BUY" ? -1 : 1));

    // Costo promedio en las dos monedas, con todo el historial.
    let qty = 0;
    let cost: Money = zero();
    let qtyBeforePeriod = 0;
    const events: TradeEvent[] = [];
    let bought = zero();
    let sold = zero();
    let realized = zero();
    let boughtQuantity = 0;
    let soldQuantity = 0;

    for (const t of own) {
      if (settledOn(t).getTime() > to) {
        if (yearOf(t.date) === year) tradesAfterEnd++;
        continue;
      }
      const quantity = Math.abs(t.quantity);
      const gross = t.amount != null ? Math.abs(t.amount) : quantity * t.price;
      const ccl = cclAt(t.date);
      const net = t.type === "BUY" ? gross + t.fee : gross - t.fee;
      const amount = toMoney(net, t.currency, ccl) ?? { ars: 0, usd: null };
      let realizedHere: Money | null = null;

      if (t.type === "BUY") {
        qty += quantity;
        cost = add(cost, amount);
      } else {
        const covered = Math.min(quantity, qty);
        const share = qty > 0 ? covered / qty : 0;
        const soldCost = scale(cost, share);
        cost = sub(cost, soldCost);
        qty -= covered;
        realizedHere = sub(amount, soldCost);
      }

      if (!inPeriod(settledOn(t))) {
        qtyBeforePeriod = qty;
        continue;
      }

      if (t.type === "BUY") {
        bought = add(bought, amount);
        boughtQuantity += quantity;
      } else {
        sold = add(sold, amount);
        soldQuantity += quantity;
        realized = add(realized, realizedHere!);
      }

      const m = monthly.get(monthOf(t.date)) ?? { month: monthOf(t.date), bought: zero(), sold: zero() };
      if (t.type === "BUY") m.bought = add(m.bought, amount);
      else m.sold = add(m.sold, amount);
      monthly.set(m.month, m);

      events.push({
        date: t.date,
        type: t.type,
        quantity,
        currency: t.currency,
        ccl,
        amount,
        unitPrice: scale(amount, 1 / quantity),
        realized: realizedHere,
        positionAfter: qty,
        avgCostAfter: qty > QTY_EPS ? scale(cost, 1 / qty) : null,
      });
    }

    const start = holdingAt(startSnap, ticker);
    const end = holdingAt(endSnap, ticker);
    const dividends = input.dividends
      .filter((d) => d.ticker === ticker && inPeriod(d.date))
      .reduce((acc, d) => add(acc, toMoney(d.amount, d.currency, cclAt(d.date)) ?? { ars: 0, usd: null }), zero());

    if (start.qty <= QTY_EPS && end.qty <= QTY_EPS && events.length === 0) continue;

    const total = add(sub(sub(end.value, start.value), bought), add(sold, dividends));
    const base = add(start.value, bought);
    const expected = start.qty + boughtQuantity - soldQuantity;

    const prices: PricePoint[] = [];
    for (const s of snapshots) {
      if (s.date.getTime() < from || s.date.getTime() > to) continue;
      const h = holdingAt(s, ticker);
      if (h.qty > QTY_EPS) prices.push({ date: s.date, unitPrice: scale(h.value, 1 / h.qty) });
    }

    results.push({
      ticker,
      startQuantity: start.qty,
      endQuantity: end.qty,
      start: start.value,
      end: end.value,
      bought,
      sold,
      boughtQuantity,
      soldQuantity,
      dividends,
      realized,
      unrealized: sub(sub(total, realized), dividends),
      total,
      returnPct: {
        ars: ratio(total.ars, base.ars),
        usd: ratio(total.usd, base.usd),
      },
      events,
      prices,
      quantityMismatch:
        Math.abs(expected - end.qty) > QTY_EPS * Math.max(1, end.qty) ? { expected, actual: end.qty } : null,
      unvaluedStart: !startSnap && qtyBeforePeriod > QTY_EPS,
    });
  }

  results.sort((a, b) => Math.abs(b.total.ars) - Math.abs(a.total.ars));

  const sum = (pick: (r: TickerResult) => Money) => results.reduce((acc, r) => add(acc, pick(r)), zero());
  return {
    year,
    start: startSnap ? { date: startSnap.date, ccl: snapCcl(startSnap) } : null,
    end: { date: endSnap.date, ccl: snapCcl(endSnap) },
    tickers: results,
    totals: {
      start: sum((r) => r.start),
      end: sum((r) => r.end),
      bought: sum((r) => r.bought),
      sold: sum((r) => r.sold),
      dividends: sum((r) => r.dividends),
      realized: sum((r) => r.realized),
      unrealized: sum((r) => r.unrealized),
      total: sum((r) => r.total),
    },
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    tradesAfterEnd,
  };
}
