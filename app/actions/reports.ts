"use server";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { userTags } from "@/lib/cache-tags";
import { isOpportunityReport } from "@/lib/opportunity-report";
import { buildSignalHistory, type SignalHistory } from "@/lib/signal-history";
import { requireUserId } from "@/lib/auth-session";
import type { ReportePortafolio } from "@/components/analysis/legacy-report";
import type { OpportunityReport } from "@/lib/opportunity-report";

export interface ReportListItem {
  id: string;
  label: string;
}

export async function listReports(): Promise<ReportListItem[]> {
  const userId = await requireUserId();
  const rows = await db.portfolioReport.findMany({
    where: { userId },
    select: { id: true, fechaReporte: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    label: `${r.fechaReporte} — ${r.createdAt.toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
  }));
}

// Devuelve el JSON guardado tal cual: un reporte de oportunidades (`version: 2`)
// o uno del formato anterior, que el historial muestra con su propio visor.
export async function getReport(id: string): Promise<OpportunityReport | ReportePortafolio | null> {
  const userId = await requireUserId();
  const row = await db.portfolioReport.findFirst({ where: { id, userId } });
  if (!row) return null;
  return row.normalizedJson as unknown as OpportunityReport | ReportePortafolio;
}

// Señal de cada acción en los últimos reportes de oportunidades (versión 2).
export async function getSignalHistory(): Promise<SignalHistory> {
  return cachedSignalHistory(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017). El route
// del análisis invalida el tag al guardar un reporte nuevo.
async function cachedSignalHistory(userId: string): Promise<SignalHistory> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.reports(userId));

  const rows = await db.portfolioReport.findMany({
    where: { userId },
    select: { id: true, createdAt: true, normalizedJson: true },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
  return buildSignalHistory(
    rows.flatMap((r) => (isOpportunityReport(r.normalizedJson) ? [{ id: r.id, createdAt: r.createdAt, report: r.normalizedJson }] : []))
  );
}

export type LatestSignals = {
  createdAt: Date;
  signals: Record<string, { senal: "compra" | "mantener" | "venta"; confianza: "alta" | "media" | "baja" }>;
};

// Señal por ticker del último reporte de oportunidades, para el Plan DCA (ADR-0022).
export async function getLatestSignals(): Promise<LatestSignals | null> {
  return cachedLatestSignals(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedLatestSignals(userId: string): Promise<LatestSignals | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.reports(userId));

  const rows = await db.portfolioReport.findMany({
    where: { userId },
    select: { createdAt: true, normalizedJson: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const latest = rows.find((r) => isOpportunityReport(r.normalizedJson));
  if (!latest || !isOpportunityReport(latest.normalizedJson)) return null;
  return {
    createdAt: latest.createdAt,
    signals: Object.fromEntries(
      latest.normalizedJson.acciones.map((a) => [a.ticker, { senal: a.senal, confianza: a.confianza }])
    ),
  };
}
