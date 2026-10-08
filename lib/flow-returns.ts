import { annualize } from "@/lib/inflation";
import { maxDrawdownPct } from "@/lib/snapshot-returns";

// Rendimiento descontando aportes y retiros (puro, sin Prisma).
//
// El valor de los snapshots sube con cada compra o suscripción al FCI aunque el
// mercado no se mueva: comparar valores mide aportes, no rendimiento. Acá se
// miden las tenencias (todo lo que figura en el snapshot) contra los flujos que
// entran o salen de ellas (compras, ventas, FCI, dividendos). Depósitos y pagos
// de la cuenta quedan afuera: mueven efectivo, que no está en el snapshot.

export type CashFlow = {
  date: Date;
  // Signo del inversor: negativo = plata que entra a las tenencias (compra,
  // suscripción); positivo = plata que sale (venta, rescate, dividendo).
  amount: number;
};

export type ValuePoint = { date: Date; value: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365;

// Categorías del libro de movimientos que cruzan el borde de las tenencias.
// PAYMENT / RECEIPT (pagos y depósitos) y CONVERSION mueven efectivo.
export const HOLDINGS_FLOW_CATEGORIES = new Set([
  "TRADE_BUY",
  "TRADE_SELL",
  "FCI_SUBSCRIPTION",
  "FCI_REDEMPTION",
  "DIVIDEND",
  "DIVIDEND_IN_KIND",
]);

export type MovementForFlow = {
  date: Date;
  category: string;
  currency: "ARS" | "USD";
  total: number;
  instrument: string | null;
};

// Convierte movimientos en flujos en ARS. Los de categoría OTHER cuentan solo
// si tienen instrumento (compra/venta de bonos para dólar MEP). Los USD se
// pasan a ARS con el CCL de su fecha; sin CCL, el movimiento se informa aparte.
export function flowsFromMovements(
  movements: MovementForFlow[],
  cclAt: (date: Date) => number | null
): { flows: CashFlow[]; sinCcl: number } {
  const flows: CashFlow[] = [];
  let sinCcl = 0;
  for (const m of movements) {
    const crossesHoldings =
      HOLDINGS_FLOW_CATEGORIES.has(m.category) || (m.category === "OTHER" && m.instrument !== null);
    if (!crossesHoldings || m.total === 0) continue;
    if (m.currency === "USD") {
      const ccl = cclAt(m.date);
      if (!ccl) {
        sinCcl++;
        continue;
      }
      flows.push({ date: m.date, amount: m.total * ccl });
    } else {
      flows.push({ date: m.date, amount: m.total });
    }
  }
  return { flows, sinCcl };
}

// Rendimiento de un período por Dietz modificado: los flujos pesan según cuánto
// del período estuvieron invertidos. Aportes = −amount (convención del inversor).
export function modifiedDietz(start: ValuePoint, end: ValuePoint, flows: CashFlow[]): number | null {
  const span = end.date.getTime() - start.date.getTime();
  if (span <= 0) return null;
  let netIn = 0;
  let weighted = 0;
  for (const f of flows) {
    const contribution = -f.amount;
    netIn += contribution;
    const weight = (end.date.getTime() - f.date.getTime()) / span;
    weighted += contribution * weight;
  }
  const base = start.value + weighted;
  if (base <= 0) return null;
  return ((end.value - start.value - netIn) / base) * 100;
}

export type PeriodReturn = { start: Date; end: Date; returnPct: number | null };

// Flujos del período (start, end]: el snapshot de inicio ya refleja lo de ese día.
function flowsIn(flows: CashFlow[], start: Date, end: Date): CashFlow[] {
  return flows.filter((f) => f.date.getTime() > start.getTime() && f.date.getTime() <= end.getTime());
}

export function periodReturns(points: ValuePoint[], flows: CashFlow[]): PeriodReturn[] {
  const out: PeriodReturn[] = [];
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    out.push({
      start: start.date,
      end: end.date,
      returnPct: modifiedDietz(start, end, flowsIn(flows, start.date, end.date)),
    });
  }
  return out;
}

// Índice base 100 encadenando los rendimientos de cada período (TWR). Un período
// sin rendimiento calculable corta la cadena: desde ahí el índice es null.
export function twrIndex(points: ValuePoint[], flows: CashFlow[]): Array<{ date: Date; index: number | null }> {
  if (points.length === 0) return [];
  const periods = periodReturns(points, flows);
  const out: Array<{ date: Date; index: number | null }> = [{ date: points[0].date, index: 100 }];
  let level: number | null = 100;
  for (const p of periods) {
    level = level === null || p.returnPct === null ? null : level * (1 + p.returnPct / 100);
    out.push({ date: p.end, index: level });
  }
  return out;
}

// Rendimiento acumulado (TWR) entre dos fechas que coinciden con snapshots.
export function twrBetween(points: ValuePoint[], flows: CashFlow[], from: Date, to: Date): number | null {
  const slice = points.filter((p) => p.date.getTime() >= from.getTime() && p.date.getTime() <= to.getTime());
  if (slice.length < 2) return null;
  const index = twrIndex(slice, flows);
  const last = index[index.length - 1].index;
  return last === null ? null : last - 100;
}

// TIR anual (XIRR) de una serie de flujos. Busca la tasa por bisección (estable
// con flujos de cualquier signo); null si no hay solución en el rango.
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;
  const hasIn = flows.some((f) => f.amount < 0);
  const hasOut = flows.some((f) => f.amount > 0);
  if (!hasIn || !hasOut) return null;

  const t0 = Math.min(...flows.map((f) => f.date.getTime()));
  const npv = (rate: number) =>
    flows.reduce((acc, f) => acc + f.amount / Math.pow(1 + rate, (f.date.getTime() - t0) / DAY_MS / YEAR_DAYS), 0);

  let lo = -0.9999;
  let hi = 100;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || Math.sign(fLo) === Math.sign(fHi)) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || hi - lo < 1e-10) return mid * 100;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return ((lo + hi) / 2) * 100;
}

// TIR de las tenencias entre el primer y el último punto: el valor inicial
// cuenta como aporte y el final como retiro.
export function holdingsXirr(points: ValuePoint[], flows: CashFlow[]): number | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return xirr([
    { date: first.date, amount: -first.value },
    ...flowsIn(flows, first.date, last.date),
    { date: last.date, amount: last.value },
  ]);
}

// Aportes netos a las tenencias en (from, to]: compras y suscripciones menos
// ventas, rescates y dividendos.
export function netContributions(flows: CashFlow[], from: Date, to: Date): number {
  return flowsIn(flows, from, to).reduce((acc, f) => acc - f.amount, 0);
}

export type ReturnSummary = {
  index: Array<{ date: Date; index: number | null }>;
  // Rendimiento de cada período, por fecha de fin (ms).
  periodReturnByEnd: Map<number, number | null>;
  yearBase: Date;
  yearReturnPct: number | null;
  // Ganancia del año descontando los aportes netos, en la moneda de la serie.
  yearGain: number;
  years: number;
  tirPct: number | null;
  twrAnnualPct: number | null;
  maxDrawdownPct: number;
};

// Con menos de ~1 mes, anualizar no informa.
const MIN_YEARS_TO_ANNUALIZE = 0.1;

// Métricas de /performance para una serie (ARS o USD) y sus flujos en la misma
// moneda. Base del año: último punto del año anterior, o el primero del año en curso.
export function returnSummary(points: ValuePoint[], flows: CashFlow[], currentYear: number): ReturnSummary | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const yearBase =
    [...points].reverse().find((p) => p.date.getUTCFullYear() < currentYear) ??
    points.find((p) => p.date.getUTCFullYear() === currentYear) ??
    first;

  const index = twrIndex(points, flows);
  const lastIndex = index[index.length - 1].index;
  const years = (last.date.getTime() - first.date.getTime()) / DAY_MS / YEAR_DAYS;
  const canAnnualize = years >= MIN_YEARS_TO_ANNUALIZE;

  return {
    index,
    periodReturnByEnd: new Map(periodReturns(points, flows).map((p) => [p.end.getTime(), p.returnPct])),
    yearBase: yearBase.date,
    yearReturnPct: twrBetween(points, flows, yearBase.date, last.date),
    yearGain: last.value - yearBase.value - netContributions(flows, yearBase.date, last.date),
    years,
    tirPct: canAnnualize ? holdingsXirr(points, flows) : null,
    twrAnnualPct: canAnnualize && lastIndex !== null ? annualize(lastIndex - 100, years) : null,
    maxDrawdownPct: maxDrawdownPct(index.flatMap((p) => (p.index === null ? [] : [p.index]))),
  };
}
