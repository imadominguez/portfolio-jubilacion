import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-session";
import { marketTags, userTags } from "@/lib/cache-tags";
import { cclLookup } from "@/lib/cash-flow";
import { loadRatioChanges } from "@/lib/portfolio-data";
import { dividendRows } from "@/lib/tax-report";
import { resultYears, tickerResults, type ResultsDividend, type YearResults } from "@/lib/ticker-results";

// Datos de /resultados. Se lee todo el historial: el costo promedio de una venta
// depende de compras de años anteriores, y son pocas filas.

export type TickerResultsData = { years: number[]; byYear: Record<number, YearResults> };

export async function getTickerResults(): Promise<TickerResultsData> {
  return cachedTickerResults(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedTickerResults(userId: string): Promise<TickerResultsData> {
  "use cache";
  cacheLife("hours");
  cacheTag(
    userTags.snapshots(userId),
    userTags.trades(userId),
    userTags.dividends(userId),
    marketTags.ccl,
    marketTags.assets
  );

  const [snapshots, transactions, dividendMovements, manualDividends, rates, changes] = await Promise.all([
    db.portfolioSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotDate: "asc" },
      select: {
        snapshotDate: true,
        ccl: true,
        positions: { select: { ticker: true, quantity: true, currency: true, positionValue: true } },
      },
    }),
    db.transaction.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      include: { movement: { select: { grossAmount: true, settlementDate: true } } },
    }),
    db.movement.findMany({
      where: { userId, category: { in: ["DIVIDEND", "DIVIDEND_IN_KIND"] } },
      orderBy: { date: "asc" },
    }),
    db.dividend.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.exchangeRate.findMany({ orderBy: { date: "asc" }, select: { date: true, ccl: true } }),
    loadRatioChanges(),
  ]);

  const cclAt = cclLookup(rates.map((r) => ({ date: r.date, ccl: Number(r.ccl) })));
  const snaps = snapshots.map((s) => ({
    date: s.snapshotDate,
    ccl: s.ccl ? Number(s.ccl) : null,
    positions: s.positions.map((p) => ({
      ticker: p.ticker,
      quantity: Number(p.quantity),
      currency: p.currency,
      value: Number(p.positionValue),
    })),
  }));
  const trades = transactions.map((t) => ({
    date: t.date,
    ticker: t.ticker,
    type: t.type,
    quantity: Number(t.quantity),
    price: Number(t.price),
    currency: t.currency,
    fee: t.fee ? Number(t.fee) : 0,
    amount: t.movement?.grossAmount != null ? Number(t.movement.grossAmount) : null,
    settlementDate: t.movement?.settlementDate ?? null,
  }));

  // Mismo criterio que /impuestos para leer los dividendos de Cocos; acá cuenta
  // el neto, así que los gastos en pesos entran como un dividendo negativo.
  const dividends: ResultsDividend[] = [];
  const rows = dividendRows(
    dividendMovements.map((m) => ({
      date: m.date,
      instrument: m.instrument,
      ticker: m.ticker,
      currency: m.currency,
      quantity: m.quantity !== null ? Number(m.quantity) : null,
      grossAmount: m.grossAmount !== null ? Number(m.grossAmount) : null,
      total: Number(m.total),
    })),
    manualDividends.map((d) => ({ date: d.date, ticker: d.ticker, amount: Number(d.amount), currency: d.currency }))
  );
  for (const r of rows) {
    dividends.push({ date: r.date, ticker: r.source, currency: r.currency, amount: r.amount });
    if (r.costsArs > 0) dividends.push({ date: r.date, ticker: r.source, currency: "ARS", amount: -r.costsArs });
  }

  const years = resultYears(snaps);
  const byYear: Record<number, YearResults> = {};
  for (const year of years) {
    const result = tickerResults({ year, trades, snapshots: snaps, dividends, cclAt, changes });
    if (result) byYear[year] = result;
  }
  return { years, byYear };
}
