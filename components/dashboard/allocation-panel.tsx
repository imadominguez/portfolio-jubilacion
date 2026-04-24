"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
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
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const LEGEND_BG_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

interface TooltipPayload {
  name: string;
  value: number;
  payload: { allocationPct: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs font-mono">
      <p className="font-bold text-foreground">{item.name}</p>
      <p className="text-muted-foreground">
        {formatARS(item.value)} · {item.payload.allocationPct.toFixed(1)}%
      </p>
    </div>
  );
}

export function AllocationPanel({ positions, totalArs }: AllocationPanelProps) {
  const data = positions.map((p) => ({
    name: p.ticker,
    value: p.positionValue,
    allocationPct: p.allocationPct,
  }));

  return (
    <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
      <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Distribución
      </p>

      <div className="rounded-xl border border-border bg-card shadow-sm p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
        {/* Donut chart */}
        <div className="h-[160px] sm:h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend rows */}
        <div className="flex flex-col gap-2 sm:gap-3">
          {positions.map((position, index) => (
            <div
              key={position.ticker}
              className="flex items-center justify-between gap-2 sm:gap-3 animate-fade-up"
              style={{ animationDelay: `${180 + index * 35}ms` }}
            >
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div
                  className={`size-2 rounded-full shrink-0 ${LEGEND_BG_COLORS[index % LEGEND_BG_COLORS.length]}`}
                />
                <span className="text-xs sm:text-sm font-mono font-semibold text-foreground truncate">
                  {position.ticker}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="w-12 sm:w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${LEGEND_BG_COLORS[index % LEGEND_BG_COLORS.length]} opacity-70 transition-all duration-700`}
                    style={{ width: `${position.allocationPct}%` }}
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-mono font-semibold tabular-nums text-muted-foreground w-9 sm:w-10 text-right">
                  {position.allocationPct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Total
          </span>
          <span className="text-xs sm:text-sm font-mono font-bold tabular-nums text-foreground">
            {formatARS(totalArs)}
          </span>
        </div>
      </div>
    </div>
  );
}
