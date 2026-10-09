// Resumen mensual por mail (puro): cuándo mandarlo y qué dice. Lo arma el cron
// con el rendimiento del año, el flujo de caja y los gastos del mes anterior, y
// el Plan DCA del mes (ADR-0020, ADR-0022).

import { localDateParts, monthKeyOf, monthLabel, shiftMonth } from "@/lib/local-date";
import type { DcaMode } from "@/lib/dca-planner";

// Si los datos del mes anterior siguen incompletos, desde este día se manda
// igual, avisando qué falta: mejor un resumen parcial que ninguno.
export const SUMMARY_LATEST_DAY = 20;

// Mes a resumir ("AAAA-MM", el anterior) si ya corresponde mandarlo; si no, null.
// Espera al día del recordatorio de carga y a que el mes esté cargado.
export function summaryMonthDue(now: Date, reminderDay: number, dataComplete: boolean): string | null {
  const today = localDateParts(now);
  if (today.day < reminderDay) return null;
  if (!dataComplete && today.day < SUMMARY_LATEST_DAY) return null;
  return shiftMonth(monthKeyOf(today), -1);
}

export type MonthlySummaryInput = {
  monthKey: string;
  year: number;
  portfolio: {
    valueArs: number;
    valueUsd: number | null;
    // Rendimiento del año sin aportes (TWR), en pesos y en dólares.
    yearReturnArsPct: number | null;
    yearReturnUsdPct: number | null;
  } | null;
  cashFlow: { deposits: number; expenses: number; savings: number; savingsRate: number | null } | null;
  topCategories: Array<{ label: string; total: number; pct: number }>;
  uncategorized: number;
  plan: {
    mode: DcaMode;
    amountArs: number;
    reportDate: string | null;
    rows: Array<{ ticker: string; amountArs: number; estimatedCedears: number | null }>;
  } | null;
  missingData: string[];
  appUrl: string;
};

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number | null) => (n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")} %`);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const PLAN_TEXT: Record<DcaMode, string> = {
  compra: "El aporte va a las acciones en \"compra\" del último reporte, ponderado por confianza.",
  mantener: "Ninguna acción está en \"compra\": el aporte se reparte entre las \"mantener\".",
  ninguna: "Todas las acciones con señal están en \"venta\": el plan no asigna el aporte.",
  iguales: "Sin reporte de oportunidades: el aporte se reparte en partes iguales.",
};

export function buildMonthlySummaryEmail(input: MonthlySummaryInput): { subject: string; text: string; html: string } {
  const month = monthLabel(input.monthKey);
  const subject = `Portfolio: resumen de ${month}`;
  const text: string[] = [];
  const html: string[] = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111;line-height:1.5">`,
    `<h1 style="font-size:20px;margin:0 0 16px">Resumen de ${escapeHtml(month)}</h1>`,
  ];
  const section = (title: string, lines: string[]) => {
    text.push(title, ...lines, "");
    html.push(
      `<h2 style="font-size:16px;margin:20px 0 8px">${escapeHtml(title)}</h2>`,
      `<ul style="margin:0;padding-left:18px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    );
  };

  if (input.missingData.length > 0) {
    const note = `Faltan datos de ${month}: ${input.missingData.join(" y ")}. Algunos números pueden estar incompletos.`;
    text.push(note, "");
    html.push(`<p style="margin:0 0 12px;padding:8px 12px;background:#fff7e6;border-radius:6px;font-size:13px">${escapeHtml(note)}</p>`);
  }

  if (input.portfolio) {
    const p = input.portfolio;
    section("Portfolio", [
      `Valor: ${ars(p.valueArs)}${p.valueUsd !== null ? ` (${usd(p.valueUsd)})` : ""}`,
      `Rendimiento ${input.year} sin aportes: ${pct(p.yearReturnArsPct)} en pesos, ${pct(p.yearReturnUsdPct)} en dólares`,
    ]);
  }

  if (input.cashFlow) {
    const c = input.cashFlow;
    section(`Flujo de caja de ${month}`, [
      `Depositaste ${ars(c.deposits)} y gastaste ${ars(c.expenses)} desde Cocos.`,
      `Ahorro: ${ars(c.savings)} (tasa ${c.savingsRate === null ? "—" : `${c.savingsRate.toFixed(0)} %`}).`,
    ]);
  }

  if (input.topCategories.length > 0 || input.uncategorized > 0) {
    const lines = input.topCategories.map((c) => `${c.label}: ${ars(c.total)} (${c.pct.toFixed(0)} %)`);
    if (input.uncategorized > 0) {
      lines.push(`${input.uncategorized} ${input.uncategorized === 1 ? "pago sin categoría" : "pagos sin categoría"}: categorizalos en Transacciones.`);
    }
    section(`En qué gastaste en ${month}`, lines);
  }

  if (input.plan) {
    const p = input.plan;
    const lines = [PLAN_TEXT[p.mode] + (p.reportDate ? ` Reporte del ${p.reportDate}.` : "")];
    for (const r of p.rows.filter((r) => r.amountArs > 0)) {
      lines.push(`${r.ticker}: ${ars(r.amountArs)}${r.estimatedCedears !== null ? ` (~${r.estimatedCedears} CEDEARs)` : ""}`);
    }
    section(`Plan DCA del mes (aporte de ${ars(p.amountArs)})`, lines);
  }

  const base = input.appUrl.replace(/\/$/, "");
  text.push(`Más detalle en ${base}/flujo y ${base}/plan`, `Configurá o desactivá este resumen en ${base}/alertas`);
  html.push(
    `<p style="margin:24px 0 0;font-size:13px">Más detalle en <a href="${escapeHtml(`${base}/flujo`)}">Flujo de caja</a> y <a href="${escapeHtml(`${base}/plan`)}">Plan DCA</a>.</p>`,
    `<p style="margin:8px 0 0;font-size:12px;color:#777">Configurá o desactivá este resumen en <a href="${escapeHtml(`${base}/alertas`)}">Alertas</a>.</p>`,
    `</div>`
  );

  return { subject, text: text.join("\n"), html: html.join("") };
}
