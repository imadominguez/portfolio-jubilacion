import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { isAdminRole } from "@/lib/user-role";
import { generateOpportunityReport } from "@/lib/opportunity-runner";
import { holdingsFlowsForUser, latestSnapshotForUser, snapshotPointsForUser } from "@/lib/portfolio-data";
import { cclLookup, monthlyCashFlow } from "@/lib/cash-flow";
import { returnSummary } from "@/lib/flow-returns";
import { expenseSummary, UNCATEGORIZED } from "@/lib/expenses";
import { planDca, type DcaSignal } from "@/lib/dca-planner";
import { reminderStatus } from "@/lib/alerts";
import { localDateParts, monthKeyOf, shiftMonth } from "@/lib/local-date";
import { isOpportunityReport } from "@/lib/opportunity-report";
import { buildMonthlySummaryEmail, summaryMonthDue, type MonthlySummaryInput } from "@/lib/monthly-summary";

// Tareas mensuales del cron diario (ADR-0020, ADR-0022), para los usuarios con
// los mails activados:
//  - Reporte de oportunidades automático (solo ADMIN, si eligió generarlo y no
//    hay uno del mes): así el Plan DCA del mes usa señales nuevas.
//  - Resumen del mes anterior por mail, cuando el mes está cargado.
// AlertLog (MONTHLY_REPORT / MONTHLY_SUMMARY, clave AAAA-MM) evita repetirlas.

// El cron entero tiene 300 s: el reporte no puede llevarse todo.
const REPORT_TIMEOUT_MS = 150_000;
const DEFAULT_MONTHLY_AMOUNT_ARS = 500_000;
const CASH_CATEGORIES = ["RECEIPT", "PAYMENT", "TRADE_BUY", "TRADE_SELL", "FCI_SUBSCRIPTION", "FCI_REDEMPTION"] as const;

function monthBounds(monthKey: string): { gte: Date; lt: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
}

const reportDateLabel = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

async function alreadyDone(userId: string, kind: "MONTHLY_REPORT" | "MONTHLY_SUMMARY", key: string) {
  return (await db.alertLog.count({ where: { userId, kind, key } })) > 0;
}

// Reporte del mes si todavía no hay uno generado desde el 1° (hora de Argentina).
async function monthlyReport(userId: string, monthKey: string, now: Date): Promise<boolean> {
  if (await alreadyDone(userId, "MONTHLY_REPORT", monthKey)) return false;
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 3)); // 00:00 en Argentina
  const existing = await db.portfolioReport.count({ where: { userId, createdAt: { gte: monthStart } } });
  if (existing === 0) {
    const result = await generateOpportunityReport(userId, { timeoutMs: REPORT_TIMEOUT_MS });
    // Si falla, no se registra: se reintenta al día siguiente.
    if (!result.ok) throw new Error(result.error);
  }
  await db.alertLog.create({ data: { userId, kind: "MONTHLY_REPORT", key: monthKey, sentAt: now } });
  return existing === 0;
}

async function buildSummaryInput(
  userId: string,
  monthKey: string,
  now: Date,
  missingData: string[]
): Promise<MonthlySummaryInput> {
  const today = localDateParts(now);
  const bounds = monthBounds(monthKey);
  const [points, flows, snapshot, movements, rates, payments, reports, settings, prices, assets] = await Promise.all([
    snapshotPointsForUser(userId),
    holdingsFlowsForUser(userId),
    latestSnapshotForUser(userId),
    db.movement.findMany({
      where: { userId, category: { in: [...CASH_CATEGORIES] }, date: bounds },
      select: { date: true, category: true, currency: true, total: true },
    }),
    db.exchangeRate.findMany({ orderBy: { date: "asc" }, select: { date: true, ccl: true } }),
    db.movement.findMany({
      where: { userId, category: "PAYMENT", currency: "ARS", date: bounds },
      include: { expenseTag: { select: { category: true, note: true } } },
    }),
    db.portfolioReport.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { createdAt: true, normalizedJson: true },
    }),
    db.retirementSettings.findFirst({ where: { userId }, select: { monthlyContribution: true } }),
    db.marketPriceCache.findMany({ select: { ticker: true, price: true } }),
    db.asset.findMany({ select: { ticker: true, cedearRatio: true, underlyingTicker: true } }),
  ]);

  // Portfolio: rendimiento del año sin aportes en pesos y en dólares.
  const year = today.year;
  const arsPoints = points.filter((p) => p.totalValueArs > 0).map((p) => ({ date: p.snapshotDate, value: p.totalValueArs }));
  const usdPoints = points
    .filter((p) => p.totalValueUsd !== null && p.totalValueUsd > 0)
    .map((p) => ({ date: p.snapshotDate, value: p.totalValueUsd! }));
  const ars = returnSummary(arsPoints, flows.flowsArs, year);
  const usd = returnSummary(usdPoints, flows.flowsUsd, year);

  // Flujo de caja y gastos del mes.
  const cclAt = cclLookup(rates.map((r) => ({ date: r.date, ccl: Number(r.ccl) })));
  const cash = monthlyCashFlow(movements.map((m) => ({ ...m, total: Number(m.total) })), cclAt).find((m) => m.monthKey === monthKey);
  const expenses = expenseSummary(
    payments.map((p) => ({
      id: p.id,
      date: p.date,
      amount: -Number(p.total),
      category: p.expenseTag?.category ?? null,
      note: p.expenseTag?.note ?? null,
    })),
    [],
    monthKey,
    today
  );

  // Plan DCA con el aporte configurado en Jubilación (USD al CCL del snapshot).
  const latest = reports.find((r) => isOpportunityReport(r.normalizedJson));
  const signals =
    latest && isOpportunityReport(latest.normalizedJson)
      ? Object.fromEntries(latest.normalizedJson.acciones.map((a) => [a.ticker, { senal: a.senal, confianza: a.confianza } as DcaSignal]))
      : null;
  const ccl = snapshot?.ccl ?? (rates.length > 0 ? Number(rates[rates.length - 1].ccl) : null);
  const amountArs =
    settings && ccl ? Math.round(Number(settings.monthlyContribution) * ccl) : DEFAULT_MONTHLY_AMOUNT_ARS;
  const plan = snapshot
    ? planDca({
        monthlyAmountArs: amountArs,
        portfolioValueArs: snapshot.totalValueArs,
        ccl,
        positions: snapshot.positions.map((p) => ({
          ticker: p.ticker,
          currentPct: p.allocationPct,
          currentValue: p.positionValue,
          currentPrice: p.price,
        })),
        assets: assets.map((a) => ({ ticker: a.ticker, cedearRatio: Number(a.cedearRatio), underlyingTicker: a.underlyingTicker })),
        marketPrices: Object.fromEntries(prices.map((p) => [p.ticker, Number(p.price)])),
        signals,
      })
    : null;

  return {
    monthKey,
    year,
    portfolio: snapshot
      ? {
          valueArs: snapshot.totalValueArs,
          valueUsd: snapshot.totalValueUsd,
          yearReturnArsPct: ars?.yearReturnPct ?? null,
          yearReturnUsdPct: usd?.yearReturnPct ?? null,
        }
      : null,
    cashFlow: cash ? { deposits: cash.deposits, expenses: cash.expenses, savings: cash.savings, savingsRate: cash.savingsRate } : null,
    topCategories: expenses.byCategory
      .filter((c) => c.category !== UNCATEGORIZED)
      .slice(0, 4)
      .map((c) => ({ label: c.label, total: c.total, pct: c.pct })),
    uncategorized: expenses.uncategorized,
    plan: plan
      ? {
          mode: plan.mode,
          amountArs,
          reportDate: latest ? reportDateLabel.format(latest.createdAt) : null,
          rows: plan.rows.map((r) => ({ ticker: r.ticker, amountArs: r.amountArs, estimatedCedears: r.estimatedCedears })),
        }
      : null,
    missingData,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  };
}

async function monthlySummary(userId: string, email: string, reminderDay: number, now: Date): Promise<boolean> {
  const prevKey = shiftMonth(monthKeyOf(localDateParts(now)), -1);
  if (await alreadyDone(userId, "MONTHLY_SUMMARY", prevKey)) return false;

  const [snapshot, lastMovement] = await Promise.all([
    db.portfolioSnapshot.findFirst({ where: { userId }, orderBy: { snapshotDate: "desc" }, select: { snapshotDate: true } }),
    db.movement.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const status = reminderStatus(prevKey, snapshot?.snapshotDate ?? null, lastMovement?.date ?? null);
  const monthKey = summaryMonthDue(now, reminderDay, !status.missingSnapshot && !status.missingMovements);
  if (!monthKey) return false;

  const missing = [
    ...(status.missingSnapshot ? ["el snapshot de tenencia"] : []),
    ...(status.missingMovements ? ["los movimientos"] : []),
  ];
  const mail = buildMonthlySummaryEmail(await buildSummaryInput(userId, monthKey, now, missing));
  await sendMail({ to: email, ...mail });
  await db.alertLog.create({ data: { userId, kind: "MONTHLY_SUMMARY", key: monthKey, sentAt: now } });
  return true;
}

// Para el botón "Mandar el resumen ahora": el mes anterior, aunque esté
// incompleto (avisa qué falta) y sin registrarlo, así el cron lo manda igual.
export async function sendMonthlySummaryNow(userId: string, email: string, now = new Date()): Promise<string> {
  const prevKey = shiftMonth(monthKeyOf(localDateParts(now)), -1);
  const [snapshot, lastMovement] = await Promise.all([
    db.portfolioSnapshot.findFirst({ where: { userId }, orderBy: { snapshotDate: "desc" }, select: { snapshotDate: true } }),
    db.movement.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const status = reminderStatus(prevKey, snapshot?.snapshotDate ?? null, lastMovement?.date ?? null);
  const missing = [
    ...(status.missingSnapshot ? ["el snapshot de tenencia"] : []),
    ...(status.missingMovements ? ["los movimientos"] : []),
  ];
  const mail = buildMonthlySummaryEmail(await buildSummaryInput(userId, prevKey, now, missing));
  await sendMail({ to: email, ...mail });
  return prevKey;
}

export type MonthlyRunResult = { reports: number; summaries: number; errors: number };

export async function runMonthlyTasks(now = new Date()): Promise<MonthlyRunResult> {
  const result: MonthlyRunResult = { reports: 0, summaries: 0, errors: 0 };
  const users = await db.alertSettings.findMany({
    where: { enabled: true },
    select: {
      userId: true,
      reminderDay: true,
      monthlySummary: true,
      monthlyReport: true,
      user: { select: { email: true, role: true } },
    },
  });
  const currentKey = monthKeyOf(localDateParts(now));

  for (const u of users) {
    try {
      if (u.monthlyReport && isAdminRole(u.user.role) && (await monthlyReport(u.userId, currentKey, now))) {
        result.reports++;
      }
    } catch {
      result.errors++;
    }
    try {
      if (u.monthlySummary && (await monthlySummary(u.userId, u.user.email, u.reminderDay, now))) {
        result.summaries++;
      }
    } catch {
      result.errors++;
    }
  }
  return result;
}
