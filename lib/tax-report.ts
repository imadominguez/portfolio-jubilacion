// Datos para la declaración anual (puro, sin Prisma): tenencia al cierre del
// año (Bienes Personales), ventas con su resultado y dividendos cobrados
// (Ganancias). La app junta los datos; el tratamiento impositivo (exenciones,
// tipo de cambio BNA, fuente) lo define quien hace la declaración.

type Currency = "ARS" | "USD";

const DAY_MS = 24 * 60 * 60 * 1000;
// Las fechas se guardan como medianoche UTC (columnas @db.Date).
const yearOf = (d: Date) => d.getUTCFullYear();

// ---------------------------------------------------------------------------
// Tenencia al cierre del año
// ---------------------------------------------------------------------------

export type SnapshotDate = { snapshotDate: Date };

// Último snapshot de cada año: el de cierre para Bienes Personales.
export function lastSnapshotPerYear<T extends SnapshotDate>(snapshots: T[]): Map<number, T> {
  const out = new Map<number, T>();
  for (const s of snapshots) {
    const prev = out.get(yearOf(s.snapshotDate));
    if (!prev || s.snapshotDate > prev.snapshotDate) out.set(yearOf(s.snapshotDate), s);
  }
  return out;
}

// Días entre el snapshot y el 31/12 de su año: si no es del cierre, la
// valuación no es la que pide la declaración.
export function daysBeforeYearEnd(date: Date): number {
  const yearEnd = Date.UTC(yearOf(date), 11, 31);
  return Math.round((yearEnd - date.getTime()) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

export type TradeForTax = {
  date: Date;
  ticker: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  fee: number;
  // Monto bruto de la operación según Cocos (positivo). Para bonos y ONs el
  // precio es cada 100 nominales, así que cantidad × precio no sirve; las
  // operaciones cargadas a mano no lo tienen.
  amount?: number | null;
  currency: Currency;
};

export type TaxSale = {
  date: Date;
  ticker: string;
  currency: Currency;
  quantity: number;
  // Precio × cantidad menos la comisión de la venta.
  proceeds: number;
  // Costo promedio ponderado de lo vendido, con las comisiones de compra, en
  // la moneda en que se compró. null si se compró en las dos monedas.
  cost: number | null;
  costCurrency: Currency | null;
  // Solo si compra y venta están en la misma moneda: comprar en pesos y vender
  // en dólares (dólar MEP) pide elegir un tipo de cambio, y eso no lo decide la app.
  result: number | null;
  // Se vendió más de lo que registran las compras importadas: el costo de la
  // diferencia es 0 y el resultado está sobreestimado.
  missingBuys: boolean;
};

const QTY_EPS = 1e-9;
const CURRENCIES: Currency[] = ["ARS", "USD"];

// Costo promedio ponderado por ticker, recorriendo todas las operaciones (el
// costo de una venta depende de compras de años anteriores).
export function salesForYear(trades: TradeForTax[], year: number): TaxSale[] {
  const sorted = [...trades].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || (a.type === "BUY" ? -1 : 1) - (b.type === "BUY" ? -1 : 1)
  );
  const lots = new Map<string, { qty: number; cost: Record<Currency, number> }>();
  const sales: TaxSale[] = [];

  for (const t of sorted) {
    const lot = lots.get(t.ticker) ?? { qty: 0, cost: { ARS: 0, USD: 0 } };
    lots.set(t.ticker, lot);
    // Las ventas importadas de Cocos traen la cantidad en negativo.
    const quantity = Math.abs(t.quantity);
    const gross = t.amount != null ? Math.abs(t.amount) : quantity * t.price;

    if (t.type === "BUY") {
      lot.qty += quantity;
      lot.cost[t.currency] += gross + t.fee;
      continue;
    }

    const covered = Math.min(quantity, lot.qty);
    const share = lot.qty > 0 ? covered / lot.qty : 0;
    const soldCost = { ARS: lot.cost.ARS * share, USD: lot.cost.USD * share };
    lot.cost.ARS -= soldCost.ARS;
    lot.cost.USD -= soldCost.USD;
    lot.qty -= covered;

    if (yearOf(t.date) !== year) continue;

    const used = CURRENCIES.filter((c) => soldCost[c] > QTY_EPS);
    const costCurrency = used.length === 0 ? t.currency : used.length === 1 ? used[0] : null;
    const cost = costCurrency === null ? null : soldCost[costCurrency];
    const proceeds = gross - t.fee;
    sales.push({
      date: t.date,
      ticker: t.ticker,
      currency: t.currency,
      quantity,
      proceeds,
      cost,
      costCurrency,
      result: cost !== null && costCurrency === t.currency ? proceeds - cost : null,
      missingBuys: quantity - covered > QTY_EPS,
    });
  }
  return sales;
}

// ---------------------------------------------------------------------------
// Dividendos
// ---------------------------------------------------------------------------

export type DividendMovementForTax = {
  date: Date;
  instrument: string | null;
  ticker: string | null;
  currency: Currency;
  quantity: number | null;
  grossAmount: number | null;
  total: number;
};

export type ManualDividendForTax = { date: Date; ticker: string; amount: number; currency: Currency };

export type TaxDividend = {
  date: Date;
  source: string;
  currency: Currency;
  amount: number;
  // Gastos y retenciones que Cocos descontó, en la moneda del movimiento (ARS).
  costsArs: number;
  manual: boolean;
};

const USD_INSTRUMENT = /d[oó]lar/i;

// Cocos acredita los dividendos de CEDEARs como "especie" dólar: el monto en
// USD viene en la cantidad y el total del movimiento son solo los gastos en
// pesos. Los dividendos en pesos traen el bruto y el neto.
export function dividendsForYear(
  movements: DividendMovementForTax[],
  manual: ManualDividendForTax[],
  year: number
): TaxDividend[] {
  const rows: TaxDividend[] = [];
  for (const m of movements) {
    if (yearOf(m.date) !== year) continue;
    const source = m.ticker ?? m.instrument ?? "Sin instrumento";
    if (m.instrument && USD_INSTRUMENT.test(m.instrument)) {
      const amount = m.quantity ?? 0;
      if (amount <= 0) continue;
      rows.push({ date: m.date, source, currency: "USD", amount, costsArs: m.total < 0 ? -m.total : 0, manual: false });
    } else {
      const amount = m.grossAmount ?? m.total;
      if (amount <= 0) continue;
      rows.push({ date: m.date, source, currency: m.currency, amount, costsArs: Math.max(0, amount - m.total), manual: false });
    }
  }
  for (const d of manual) {
    if (yearOf(d.date) !== year || d.amount <= 0) continue;
    rows.push({ date: d.date, source: d.ticker, currency: d.currency, amount: d.amount, costsArs: 0, manual: true });
  }
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ---------------------------------------------------------------------------
// Totales y años
// ---------------------------------------------------------------------------

export function totalsByCurrency<T extends { currency: Currency }>(
  rows: T[],
  value: (row: T) => number
): Partial<Record<Currency, number>> {
  const out: Partial<Record<Currency, number>> = {};
  for (const r of rows) out[r.currency] = (out[r.currency] ?? 0) + value(r);
  return out;
}

// Años con algún dato, del más reciente al más viejo.
export function taxYears(dates: Date[]): number[] {
  return [...new Set(dates.map(yearOf))].sort((a, b) => b - a);
}

// Por defecto, el último año cerrado con datos (la declaración es del año
// anterior); si todos son del año en curso, ese.
export function defaultTaxYear(years: number[], currentYear: number): number | null {
  return years.find((y) => y < currentYear) ?? years[0] ?? null;
}

// ---------------------------------------------------------------------------
// Reporte y CSV
// ---------------------------------------------------------------------------

export type TaxHoldingPosition = {
  ticker: string;
  instrumentName: string | null;
  quantity: number;
  price: number;
  value: number;
};

export type TaxHoldings = {
  snapshotDate: Date;
  totalValueArs: number;
  ccl: number | null;
  daysBeforeYearEnd: number;
  positions: TaxHoldingPosition[];
};

export type TaxReport = {
  year: number;
  holdings: TaxHoldings | null;
  sales: TaxSale[];
  dividends: TaxDividend[];
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
// Excel en español abre bien `;` como separador y `,` como decimal.
const num = (n: number, decimals = 2) => n.toFixed(decimals).replace(".", ",");
const qty = (n: number) => String(n).replace(".", ",");
const text = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function taxReportCsv(report: TaxReport): string {
  const lines: string[] = [];
  const row = (...cells: string[]) => lines.push(cells.join(";"));

  row(`Tenencia al cierre ${report.year} (Bienes Personales)`);
  if (report.holdings) {
    row("Fecha del snapshot", isoDate(report.holdings.snapshotDate));
    row("Ticker", "Instrumento", "Cantidad", "Precio ARS", "Valor ARS");
    for (const p of report.holdings.positions) {
      row(text(p.ticker), text(p.instrumentName ?? ""), qty(p.quantity), num(p.price, 4), num(p.value));
    }
    row("Total", "", "", "", num(report.holdings.totalValueArs));
  } else {
    row("Sin snapshot en el año");
  }

  lines.push("");
  row(`Ventas ${report.year}`);
  row("Fecha", "Ticker", "Moneda", "Cantidad", "Ingreso neto", "Moneda del costo", "Costo", "Resultado", "Faltan compras");
  for (const s of report.sales) {
    row(
      isoDate(s.date),
      text(s.ticker),
      s.currency,
      qty(s.quantity),
      num(s.proceeds),
      s.costCurrency ?? "Mixta",
      s.cost === null ? "" : num(s.cost),
      s.result === null ? "" : num(s.result),
      s.missingBuys ? "Sí" : ""
    );
  }

  lines.push("");
  row(`Dividendos ${report.year}`);
  row("Fecha", "Instrumento", "Moneda", "Monto", "Gastos ARS", "Origen");
  for (const d of report.dividends) {
    row(isoDate(d.date), text(d.source), d.currency, num(d.amount), num(d.costsArs), d.manual ? "Manual" : "Cocos");
  }

  // BOM: sin él, Excel abre el archivo como ANSI y rompe los acentos.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
