"use server";

import { db } from "@/lib/db";
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
