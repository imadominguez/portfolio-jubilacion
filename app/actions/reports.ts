"use server";

import { db } from "@/lib/db";
import type { ReportePortafolio } from "@/components/analysis/portfolio-analizer";

export interface ReportListItem {
  id: string;
  label: string;
}

export async function listReports(): Promise<ReportListItem[]> {
  const rows = await db.portfolioReport.findMany({
    select: { id: true, fechaReporte: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    label: `${r.fechaReporte} — ${r.createdAt.toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
  }));
}

export async function getReport(id: string): Promise<ReportePortafolio | null> {
  const row = await db.portfolioReport.findUnique({ where: { id } });
  if (!row) return null;
  return row.normalizedJson as unknown as ReportePortafolio;
}
