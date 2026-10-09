import { ArrowRightLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Signal, SignalCell, SignalHistory } from "@/lib/signal-history";

const SIGNAL_STYLE: Record<Signal, string> = {
  compra: "bg-success/15 text-success",
  mantener: "bg-muted text-muted-foreground",
  venta: "bg-destructive/15 text-destructive",
};

const dateLabel = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});
const timeLabel = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function Cell({ cell }: { cell: SignalCell }) {
  if (!cell) return <span className="text-xs text-muted-foreground/50">—</span>;
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${SIGNAL_STYLE[cell.senal]}`}>
        {cell.senal}
      </span>
      <span className="text-[10px] text-muted-foreground">{cell.confianza}</span>
    </span>
  );
}

// Cómo cambió la señal de cada acción entre los últimos reportes.
export function SignalHistoryTable({ history }: { history: SignalHistory }) {
  const labels = history.reports.map((r) => dateLabel.format(r.createdAt));
  // Dos reportes del mismo día se distinguen por la hora.
  const withTime = history.reports.map((r, i) =>
    labels.filter((l) => l === labels[i]).length > 1 ? `${labels[i]} ${timeLabel.format(r.createdAt)}` : labels[i]
  );
  const changes = history.rows.filter((r) => r.changed).length;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8 space-y-4">
      <Separator />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Señales por acción</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {history.reports.length === 1
            ? "Con el próximo reporte vas a ver cómo cambia la señal de cada acción."
            : changes > 0
              ? `${changes} ${changes === 1 ? "acción cambió" : "acciones cambiaron"} de señal en el último reporte.`
              : "Ninguna acción cambió de señal en el último reporte."}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground/70">
              <th className="px-4 py-2.5 text-left font-semibold">Acción</th>
              {withTime.map((label, i) => (
                <th key={history.reports[i].id} className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.rows.map((row) => (
              <tr key={row.ticker} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className="font-mono font-bold">{row.ticker}</span>
                  {row.changed && (
                    <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      cambió
                    </span>
                  )}
                </td>
                {row.cells.map((cell, i) => (
                  <td key={history.reports[i].id} className="px-3 py-2 text-center">
                    <Cell cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
