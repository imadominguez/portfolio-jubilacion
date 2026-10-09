// Historial de señales por acción a partir de los reportes de oportunidades
// guardados (puro, sin Prisma). Una fila por ticker y una columna por reporte.

import type { OpportunityReport } from "@/lib/opportunity-report";

export type Signal = OpportunityReport["acciones"][number]["senal"];
export type Confidence = OpportunityReport["acciones"][number]["confianza"];
export type SignalCell = { senal: Signal; confianza: Confidence } | null;

export type SignalHistoryRow = {
  ticker: string;
  // Una por reporte, del más viejo al más nuevo; null si el ticker no estaba.
  cells: SignalCell[];
  // La señal del último reporte que la incluye difiere de la anterior.
  changed: boolean;
};

export type SignalHistory = {
  reports: Array<{ id: string; createdAt: Date }>;
  rows: SignalHistoryRow[];
};

const SIGNAL_ORDER: Record<Signal, number> = { compra: 0, mantener: 1, venta: 2 };

export function buildSignalHistory(
  reports: Array<{ id: string; createdAt: Date; report: OpportunityReport }>,
  maxReports = 6
): SignalHistory {
  const recent = [...reports]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(-maxReports);

  const tickers = new Map<string, SignalCell[]>();
  recent.forEach((r, i) => {
    for (const a of r.report.acciones) {
      const cells = tickers.get(a.ticker) ?? Array<SignalCell>(recent.length).fill(null);
      cells[i] = { senal: a.senal, confianza: a.confianza };
      tickers.set(a.ticker, cells);
    }
  });

  const rows = [...tickers].map(([ticker, cells]) => {
    const present = cells.filter((c): c is NonNullable<SignalCell> => c !== null);
    const changed = present.length >= 2 && present[present.length - 1].senal !== present[present.length - 2].senal;
    return { ticker, cells, changed };
  });

  // Primero lo que está en el último reporte, ordenado por señal (compra,
  // mantener, venta) y ticker; después los que ya no aparecen.
  const last = (row: SignalHistoryRow) => row.cells[row.cells.length - 1];
  rows.sort((a, b) => {
    const la = last(a);
    const lb = last(b);
    if (la && !lb) return -1;
    if (!la && lb) return 1;
    if (la && lb && la.senal !== lb.senal) return SIGNAL_ORDER[la.senal] - SIGNAL_ORDER[lb.senal];
    return a.ticker.localeCompare(b.ticker);
  });

  return { reports: recent.map(({ id, createdAt }) => ({ id, createdAt })), rows };
}
