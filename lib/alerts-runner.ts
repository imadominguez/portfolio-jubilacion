import { db } from "@/lib/db";
import { getHistorical, getNews } from "@/lib/yahoo-finance-client";
import { priceSignals, selectNews, type PricePoint } from "@/lib/opportunity-signals";
import { mapLimit } from "@/lib/map-limit";
import { sendMail } from "@/lib/mailer";
import {
  buildAlertEmail,
  dropReasons,
  reminderMonth,
  reminderStatus,
  sessionChangePct,
  shouldNotifyDrop,
  shouldNotifyReminder,
  type BudgetAlert,
  type DropAlert,
  type ReminderAlert,
} from "@/lib/alerts";
import { budgetStatus, expenseSummary } from "@/lib/expenses";
import { localDateParts, monthKeyOf } from "@/lib/local-date";

// Corre las alertas por mail (ADR-0020): lee los datos del usuario, pide
// precios y titulares a Yahoo, manda un único mail y registra lo enviado en
// AlertLog. Lo usan el cron (/api/cron/alerts, todos los usuarios con alertas
// activas) y la Server Action "Revisar ahora" (solo el usuario de la sesión).
// Los precios no se guardan en las caches: son un dato de entrada de la alerta,
// como en el reporte de oportunidades (ADR-0018).

const HISTORY_DAYS = 370;
const YAHOO_CONCURRENCY = 4;
const NEWS_MAX = 3;
const NEWS_MAX_AGE_DAYS = 14;

// Historia por subyacente compartida entre usuarios en una misma corrida.
export type HistoryCache = Map<string, Promise<PricePoint[] | null>>;

export type AlertRunResult = {
  sent: boolean;
  drops: string[];
  reminder: ReminderAlert | null;
  // Acciones sin subyacente o sin precios de Yahoo: no se pudieron revisar.
  unchecked: string[];
};

function historyFor(underlying: string, cache: HistoryCache, now: Date): Promise<PricePoint[] | null> {
  let pending = cache.get(underlying);
  if (!pending) {
    pending = getHistorical(underlying, new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000)).catch(
      () => null
    );
    cache.set(underlying, pending);
  }
  return pending;
}

export async function runAlertsForUser(
  userId: string,
  options: { now?: Date; force?: boolean; cache?: HistoryCache; appUrl?: string } = {}
): Promise<AlertRunResult> {
  const now = options.now ?? new Date();
  const cache = options.cache ?? new Map();
  // `force` (Revisar ahora) ignora la regla de no repetir: muestra todo lo que
  // hoy cumple los umbrales.
  const force = options.force ?? false;

  const [user, settings, snapshot, lastMovement, assets] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
    db.alertSettings.findUnique({ where: { userId } }),
    db.portfolioSnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotDate: "desc" },
      include: { positions: true },
    }),
    db.movement.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { date: true } }),
    db.asset.findMany({ select: { ticker: true, underlyingTicker: true } }),
  ]);
  if (!user) throw new Error("Usuario inexistente.");

  const thresholds = {
    dropFromHighPct: settings ? Number(settings.dropFromHighPct) : 15,
    weeklyDropPct: settings ? Number(settings.weeklyDropPct) : 8,
  };
  const reminderDay = settings?.reminderDay ?? 5;

  // --- Caídas -------------------------------------------------------------
  const underlyingByTicker = new Map(assets.map((a) => [a.ticker, a.underlyingTicker]));
  const unchecked: string[] = [];
  const candidates = await mapLimit(snapshot?.positions ?? [], YAHOO_CONCURRENCY, async (pos) => {
    const underlying = underlyingByTicker.get(pos.ticker);
    if (!underlying) {
      unchecked.push(pos.ticker);
      return null;
    }
    const history = await historyFor(underlying, cache, now);
    const signals = history ? priceSignals(history) : null;
    if (!history || !signals) {
      unchecked.push(pos.ticker);
      return null;
    }
    const change5dPct = sessionChangePct(history);
    const reasons = dropReasons({ fromHigh52wPct: signals.fromHigh52wPct, change5dPct }, thresholds);
    if (reasons.length === 0) return null;
    return { pos, underlying, signals, change5dPct, reasons };
  });

  const drops: DropAlert[] = [];
  for (const c of candidates) {
    if (!c) continue;
    const last = await db.alertLog.findFirst({
      where: { userId, kind: "PRICE_DROP", key: c.pos.ticker },
      orderBy: { sentAt: "desc" },
    });
    const lastAlert = last ? { value: last.value !== null ? Number(last.value) : null, sentAt: last.sentAt } : null;
    if (!force && !shouldNotifyDrop(c.signals.fromHigh52wPct, lastAlert, now)) continue;
    const news = await getNews(c.underlying).catch(() => []);
    drops.push({
      ticker: c.pos.ticker,
      underlying: c.underlying,
      companyName: c.pos.instrumentName,
      lastClose: c.signals.lastClose,
      lastDate: c.signals.lastDate,
      high52w: c.signals.high52w,
      fromHigh52wPct: c.signals.fromHigh52wPct,
      change5dPct: c.change5dPct,
      reasons: c.reasons,
      news: selectNews(news, c.underlying, {
        companyName: c.pos.instrumentName,
        max: NEWS_MAX,
        maxAgeDays: NEWS_MAX_AGE_DAYS,
        now,
      }),
    });
  }

  // --- Recordatorio -------------------------------------------------------
  let reminder: ReminderAlert | null = null;
  const monthKey = reminderMonth(now, reminderDay);
  if (monthKey) {
    const status = reminderStatus(monthKey, snapshot?.snapshotDate ?? null, lastMovement?.date ?? null);
    if (status.missingSnapshot || status.missingMovements) {
      const last = await db.alertLog.findFirst({
        where: { userId, kind: "REMINDER", key: monthKey },
        orderBy: { sentAt: "desc" },
      });
      if (force || shouldNotifyReminder(last?.sentAt ?? null, now)) {
        reminder = { monthKey, ...status };
      }
    }
  }

  // --- Presupuestos del mes en curso -----------------------------------------
  const today = localDateParts(now);
  const currentMonth = monthKeyOf(today);
  const budgets: BudgetAlert[] = [];
  const budgetRows = await db.expenseBudget.findMany({ where: { userId }, select: { category: true, amountArs: true } });
  if (budgetRows.length > 0) {
    const [year, month] = currentMonth.split("-").map(Number);
    const payments = await db.movement.findMany({
      where: {
        userId,
        category: "PAYMENT",
        currency: "ARS",
        date: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) },
      },
      select: { id: true, date: true, total: true, expenseTag: { select: { category: true } } },
    });
    const summary = expenseSummary(
      payments.map((p) => ({ id: p.id, date: p.date, amount: -Number(p.total), category: p.expenseTag?.category ?? null, note: null })),
      [],
      currentMonth,
      today
    );
    const over = budgetStatus(summary.byCategory, Object.fromEntries(budgetRows.map((b) => [b.category, Number(b.amountArs)]))).filter((b) => b.over);
    for (const b of over) {
      const key = `${currentMonth}:${b.category}`;
      const sent = await db.alertLog.count({ where: { userId, kind: "BUDGET", key } });
      if (force || sent === 0) budgets.push({ monthKey: currentMonth, category: b.category, label: b.label, spent: b.spent, budget: b.budget });
    }
  }

  const email = buildAlertEmail(drops, reminder, options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "", budgets);
  if (email) {
    await sendMail({ to: user.email, ...email });
    await db.alertLog.createMany({
      data: [
        ...drops.map((d) => ({
          userId,
          kind: "PRICE_DROP" as const,
          key: d.ticker,
          value: Math.round(d.fromHigh52wPct * 100) / 100,
          sentAt: now,
        })),
        ...(reminder ? [{ userId, kind: "REMINDER" as const, key: reminder.monthKey, sentAt: now }] : []),
        ...budgets.map((b) => ({ userId, kind: "BUDGET" as const, key: `${b.monthKey}:${b.category}`, value: Math.round(b.spent), sentAt: now })),
      ],
    });
  }

  return { sent: email !== null, drops: drops.map((d) => d.ticker), reminder, unchecked };
}

// Todos los usuarios con alertas activas. Un usuario que falla no corta al resto.
export async function runAllAlerts(now = new Date()) {
  const enabled = await db.alertSettings.findMany({ where: { enabled: true }, select: { userId: true } });
  const cache: HistoryCache = new Map();
  const results: Array<{ ok: boolean; sent: boolean; drops: number; reminder: boolean }> = [];
  for (const { userId } of enabled) {
    try {
      const r = await runAlertsForUser(userId, { now, cache });
      results.push({ ok: true, sent: r.sent, drops: r.drops.length, reminder: r.reminder !== null });
    } catch {
      results.push({ ok: false, sent: false, drops: 0, reminder: false });
    }
  }
  return results;
}
