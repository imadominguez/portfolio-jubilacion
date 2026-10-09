// Flujo de caja mensual de la cuenta de Cocos (puro, sin Prisma): cuánto se
// depositó, cuánto se gastó, cuánto se ahorró y adónde fue.
// Solo ve lo que pasa por Cocos: los ingresos que no se depositan ahí no están.

import { flowsFromMovements, type MovementForFlow } from "@/lib/flow-returns";

export type CashMovement = {
  date: Date;
  category: string;
  currency: "ARS" | "USD";
  total: number;
};

export type MonthCashFlow = {
  monthKey: string;
  // Recibos de cobro: plata que entró a la cuenta.
  deposits: number;
  // Órdenes de pago (positivo); un reintegro resta.
  expenses: number;
  // deposits − expenses.
  savings: number;
  // savings / deposits; null sin depósitos.
  savingsRate: number | null;
  // Compras menos ventas de CEDEARs y bonos (positivo = se invirtió).
  invested: number;
  // Suscripciones menos rescates del FCI (positivo = se estacionó plata).
  fciNet: number;
};

// CCL del día o el último anterior (los fines de semana no tienen cotización).
// `rates` ordenadas por fecha ascendente.
export function cclLookup(rates: Array<{ date: Date; ccl: number }>): (date: Date) => number | null {
  return (date) => {
    let lo = 0;
    let hi = rates.length - 1;
    let found: number | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rates[mid].date.getTime() <= date.getTime()) {
        found = rates[mid].ccl;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found;
  };
}

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

// Montos en pesos. Los movimientos en dólares se pasan al CCL de su fecha: así
// una ON comprada en pesos y vendida en dólares (dólar MEP) se compensa en vez
// de contar como inversión. Sin CCL, el movimiento se omite.
export function monthlyCashFlow(
  movements: CashMovement[],
  cclAt: (date: Date) => number | null
): MonthCashFlow[] {
  const months = new Map<string, MonthCashFlow>();
  const get = (key: string) => {
    let m = months.get(key);
    if (!m) {
      m = { monthKey: key, deposits: 0, expenses: 0, savings: 0, savingsRate: null, invested: 0, fciNet: 0 };
      months.set(key, m);
    }
    return m;
  };

  for (const mv of movements) {
    let amount = mv.total;
    if (mv.currency === "USD") {
      const ccl = cclAt(mv.date);
      if (!ccl) continue;
      amount *= ccl;
    }
    const m = get(monthOf(mv.date));
    switch (mv.category) {
      case "RECEIPT":
        m.deposits += amount;
        break;
      case "PAYMENT":
        m.expenses -= amount;
        break;
      case "TRADE_BUY":
      case "TRADE_SELL":
        m.invested -= amount;
        break;
      case "FCI_SUBSCRIPTION":
      case "FCI_REDEMPTION":
        m.fciNet -= amount;
        break;
    }
  }

  return [...months.values()]
    .map((m) => {
      const savings = m.deposits - m.expenses;
      return { ...m, savings, savingsRate: m.deposits > 0 ? (savings / m.deposits) * 100 : null };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export type CashFlowSummary = {
  months: number;
  deposits: number;
  expenses: number;
  savings: number;
  // Ponderada por depósitos: ahorro total / depósitos totales.
  savingsRate: number | null;
  invested: number;
  averageMonthlyExpenses: number;
};

export function cashFlowSummary(months: MonthCashFlow[]): CashFlowSummary {
  const sum = (f: (m: MonthCashFlow) => number) => months.reduce((acc, m) => acc + f(m), 0);
  const deposits = sum((m) => m.deposits);
  const expenses = sum((m) => m.expenses);
  const savings = deposits - expenses;
  return {
    months: months.length,
    deposits,
    expenses,
    savings,
    savingsRate: deposits > 0 ? (savings / deposits) * 100 : null,
    invested: sum((m) => m.invested),
    averageMonthlyExpenses: months.length > 0 ? expenses / months.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Aporte real al portfolio (Jubilación)
// ---------------------------------------------------------------------------

export type ContributionStats = {
  fromMonth: string;
  toMonth: string;
  months: number;
  // Aporte neto a las tenencias (ADR-0019) en USD: compras, ventas, FCI y
  // dividendos, cada flujo al CCL de su fecha.
  totalUsd: number;
  monthlyUsd: number;
  // Solo compras menos ventas de CEDEARs y bonos, en USD por mes.
  tradesMonthlyUsd: number;
};

const TRADE_CATEGORIES = new Set(["TRADE_BUY", "TRADE_SELL"]);

// Promedio mensual del aporte en los meses [fromMonth, toMonth] (claves AAAA-MM).
export function contributionStats(
  movements: MovementForFlow[],
  cclAt: (date: Date) => number | null,
  fromMonth: string,
  toMonth: string
): ContributionStats {
  const inWindow = movements.filter((m) => {
    const key = m.date.toISOString().slice(0, 7);
    return key >= fromMonth && key <= toMonth;
  });
  const toUsd = (list: MovementForFlow[]) =>
    flowsFromMovements(list, cclAt).flows.reduce((acc, f) => {
      const ccl = cclAt(f.date);
      return ccl ? acc - f.amount / ccl : acc;
    }, 0);

  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  const months = Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
  const totalUsd = toUsd(inWindow);
  return {
    fromMonth,
    toMonth,
    months,
    totalUsd,
    monthlyUsd: totalUsd / months,
    tradesMonthlyUsd: toUsd(inWindow.filter((m) => TRADE_CATEGORIES.has(m.category))) / months,
  };
}
