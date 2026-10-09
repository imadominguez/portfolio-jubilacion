// Alertas por mail (puro, sin Prisma ni red): qué caídas avisar, cuándo
// repetirlas, cuándo recordar la carga del mes y el contenido del mail (ADR-0020).

import type { NewsItem, PricePoint } from "@/lib/opportunity-signals";
import { pctChange } from "@/lib/snapshot-returns";
import { localDateParts, monthKeyOf, monthLabel, shiftMonth } from "@/lib/local-date";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AlertThresholds = {
  // Caída desde el máximo de 52 semanas, en % (positivo: 15 = −15 %).
  dropFromHighPct: number;
  // Caída en las últimas 5 ruedas, en %.
  weeklyDropPct: number;
};

export const DEFAULT_THRESHOLDS: AlertThresholds = { dropFromHighPct: 15, weeklyDropPct: 8 };
export const DEFAULT_REMINDER_DAY = 5;

// ---------------------------------------------------------------------------
// Caídas
// ---------------------------------------------------------------------------

// Variación del último cierre contra el de `sessions` ruedas antes.
export function sessionChangePct(history: PricePoint[], sessions = 5): number | null {
  const sorted = history
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (sorted.length <= sessions) return null;
  return pctChange(sorted[sorted.length - 1].close, sorted[sorted.length - 1 - sessions].close);
}

export type DropSignals = {
  // Negativo: cuánto está por debajo del máximo de 52 semanas.
  fromHigh52wPct: number;
  change5dPct: number | null;
};

export type DropReason = "fromHigh" | "weekly";

export function dropReasons(s: DropSignals, t: AlertThresholds): DropReason[] {
  const reasons: DropReason[] = [];
  if (s.fromHigh52wPct <= -t.dropFromHighPct) reasons.push("fromHigh");
  if (s.change5dPct !== null && s.change5dPct <= -t.weeklyDropPct) reasons.push("weekly");
  return reasons;
}

export type LastAlert = { value: number | null; sentAt: Date };

// Puntos adicionales de caída desde el máximo que justifican volver a avisar
// antes de los 7 días.
const DEEPER_DROP_PP = 5;
const DROP_REPEAT_DAYS = 7;

// No repetir la misma caída todos los días: vuelve a avisar a los 7 días o si
// se profundizó al menos 5 puntos desde el último aviso.
export function shouldNotifyDrop(fromHigh52wPct: number, last: LastAlert | null, now: Date): boolean {
  if (!last) return true;
  if (now.getTime() - last.sentAt.getTime() >= DROP_REPEAT_DAYS * DAY_MS) return true;
  return last.value !== null && fromHigh52wPct <= last.value - DEEPER_DROP_PP;
}

// ---------------------------------------------------------------------------
// Recordatorio de carga mensual
// ---------------------------------------------------------------------------

// Mes a recordar ("AAAA-MM", el anterior al actual) si ya pasó el día del
// recordatorio; si no, null.
export function reminderMonth(now: Date, reminderDay: number): string | null {
  const today = localDateParts(now);
  if (today.day < reminderDay) return null;
  return shiftMonth(monthKeyOf(today), -1);
}

export type ReminderStatus = { missingSnapshot: boolean; missingMovements: boolean };

// Margen para el último movimiento: una semana sin operaciones al final del
// mes no debería disparar el recordatorio.
const MOVEMENT_SLACK_DAYS = 7;

// El mes está cargado si hay un snapshot con fecha desde el 1° de ese mes y
// movimientos hasta su última semana. Las fechas de la DB son medianoche UTC.
export function reminderStatus(
  monthKey: string,
  lastSnapshotDate: Date | null,
  lastMovementDate: Date | null
): ReminderStatus {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 0);
  return {
    missingSnapshot: lastSnapshotDate === null || lastSnapshotDate.getTime() < monthStart,
    missingMovements:
      lastMovementDate === null || lastMovementDate.getTime() < monthEnd - MOVEMENT_SLACK_DAYS * DAY_MS,
  };
}

const REMINDER_REPEAT_DAYS = 3;

export function shouldNotifyReminder(lastSentAt: Date | null, now: Date): boolean {
  return lastSentAt === null || now.getTime() - lastSentAt.getTime() >= REMINDER_REPEAT_DAYS * DAY_MS;
}

// ---------------------------------------------------------------------------
// Mail
// ---------------------------------------------------------------------------

export type DropAlert = {
  ticker: string;
  underlying: string;
  companyName: string | null;
  lastClose: number;
  lastDate: Date;
  high52w: number;
  fromHigh52wPct: number;
  change5dPct: number | null;
  reasons: DropReason[];
  news: NewsItem[];
};

export type ReminderAlert = ReminderStatus & { monthKey: string };

export type AlertEmail = { subject: string; text: string; html: string };

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")} %`;
const usd = (n: number) => `US$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(d);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function dropSummary(d: DropAlert): string {
  const parts = [`${pct(d.fromHigh52wPct)} desde el máximo de 52 semanas (${usd(d.high52w)})`];
  if (d.change5dPct !== null) parts.push(`${pct(d.change5dPct)} en 5 ruedas`);
  return parts.join(" · ");
}

function reminderLines(r: ReminderAlert): string[] {
  const lines: string[] = [];
  if (r.missingSnapshot) lines.push(`Importá el reporte de tenencia (Portfolio) de ${monthLabel(r.monthKey)}.`);
  if (r.missingMovements) lines.push(`Importá los movimientos (Actividad) de ${monthLabel(r.monthKey)}.`);
  return lines;
}

export function buildAlertEmail(
  drops: DropAlert[],
  reminder: ReminderAlert | null,
  appUrl: string
): AlertEmail | null {
  if (drops.length === 0 && reminder === null) return null;

  const subjectParts: string[] = [];
  if (drops.length > 0) {
    subjectParts.push(
      drops.length === 1
        ? `${drops[0].ticker} cayó ${pct(drops[0].fromHigh52wPct)} desde su máximo`
        : `${drops.length} acciones en caída`
    );
  }
  if (reminder) subjectParts.push(`falta cargar ${monthLabel(reminder.monthKey)}`);
  const subject = `Portfolio: ${subjectParts.join(" y ")}`;

  const text: string[] = [];
  const html: string[] = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111;line-height:1.5">`,
  ];

  if (drops.length > 0) {
    text.push("Caídas en tus acciones", "");
    html.push(`<h2 style="font-size:18px;margin:0 0 12px">Caídas en tus acciones</h2>`);
    for (const d of drops) {
      const name = d.companyName ? `${d.ticker} (${d.underlying}, ${d.companyName})` : `${d.ticker} (${d.underlying})`;
      text.push(`${name}: ${usd(d.lastClose)} al ${shortDate(d.lastDate)}. ${dropSummary(d)}.`);
      html.push(
        `<div style="margin:0 0 16px;padding:12px;border:1px solid #e5e5e5;border-radius:8px">`,
        `<p style="margin:0;font-weight:600">${escapeHtml(name)}</p>`,
        `<p style="margin:4px 0 0">${usd(d.lastClose)} al ${shortDate(d.lastDate)}. ${escapeHtml(dropSummary(d))}.</p>`
      );
      if (d.news.length > 0) {
        text.push("  Titulares recientes:");
        html.push(`<p style="margin:8px 0 4px;font-size:13px;color:#555">Titulares recientes:</p><ul style="margin:0;padding-left:18px;font-size:13px">`);
        for (const n of d.news) {
          text.push(`  - ${n.title} (${n.publisher}, ${shortDate(n.publishedAt)})`);
          html.push(`<li>${escapeHtml(n.title)} <span style="color:#777">(${escapeHtml(n.publisher)}, ${shortDate(n.publishedAt)})</span></li>`);
        }
        html.push(`</ul>`);
      } else {
        text.push("  Sin titulares recientes de la empresa: puede ser una caída del mercado.");
        html.push(`<p style="margin:8px 0 0;font-size:13px;color:#555">Sin titulares recientes de la empresa: puede ser una caída del mercado.</p>`);
      }
      text.push("");
      html.push(`</div>`);
    }
  }

  if (reminder) {
    const lines = reminderLines(reminder);
    text.push(`Falta cargar ${monthLabel(reminder.monthKey)}`, ...lines, "");
    html.push(
      `<h2 style="font-size:18px;margin:16px 0 8px">Falta cargar ${monthLabel(reminder.monthKey)}</h2>`,
      `<ul style="margin:0;padding-left:18px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
      `<p style="margin:8px 0 0;font-size:13px;color:#555">Sin esos datos, el rendimiento sin aportes y el reporte para impuestos quedan incompletos.</p>`
    );
  }

  const settingsUrl = `${appUrl.replace(/\/$/, "")}/alertas`;
  text.push(`Configurá o desactivá las alertas en ${settingsUrl}`);
  html.push(
    `<p style="margin:24px 0 0;font-size:12px;color:#777">Configurá o desactivá las alertas en <a href="${escapeHtml(settingsUrl)}">${escapeHtml(settingsUrl)}</a>.</p>`,
    `</div>`
  );

  return { subject, text: text.join("\n"), html: html.join("") };
}
