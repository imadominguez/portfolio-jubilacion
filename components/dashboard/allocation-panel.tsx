import type { PositionRow } from "@/lib/portfolio-data";

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface AllocationPanelProps {
  positions: PositionRow[];
  totalArs: number;
}

const COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export function AllocationPanel({ positions, totalArs }: AllocationPanelProps) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
      <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Distribución
      </p>

      <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-4">
        {/* Stacked bar */}
        <div className="h-2 w-full rounded-full overflow-hidden flex gap-px">
          {positions.map((position, index) => (
            <div
              key={position.ticker}
              className={`h-full transition-all duration-700 ${COLORS[index % COLORS.length]}`}
              style={{ width: `${position.allocationPct}%` }}
            />
          ))}
        </div>

        {/* Legend rows */}
        <div className="flex flex-col gap-3">
          {positions.map((position, index) => (
            <div
              key={position.ticker}
              className="flex items-center justify-between gap-3 animate-fade-up"
              style={{ animationDelay: `${180 + index * 35}ms` }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`size-2 rounded-full shrink-0 ${COLORS[index % COLORS.length]}`}
                />
                <span className="text-sm font-mono font-semibold text-foreground truncate">
                  {position.ticker}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${COLORS[index % COLORS.length]} opacity-70 transition-all duration-700`}
                    style={{ width: `${position.allocationPct}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-semibold tabular-nums text-muted-foreground w-10 text-right">
                  {position.allocationPct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Total
          </span>
          <span className="text-sm font-mono font-bold tabular-nums text-foreground">
            {formatARS(totalArs)}
          </span>
        </div>
      </div>
    </div>
  );
}
