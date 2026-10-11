"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { PositionRow } from "@/lib/portfolio-data";
import { formatARS, formatPct } from "@/lib/format";

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
        {formatARS(item.value)} · {formatPct(item.payload.allocationPct, { decimals: 1 })}
      </p>
    </div>
  );
}

// Cinco colores de serie y el resto agrupado: con 16 porciones los colores se
// repetían y la leyenda no permitía reconocer cuál era cuál. El detalle completo
// está en la tabla de posiciones.
const TOP = 5;
const OTHERS_COLOR = "color-mix(in oklab, var(--color-muted-foreground) 45%, transparent)";

export function AllocationPanel({ positions, totalArs }: AllocationPanelProps) {
  const sorted = [...positions].sort((a, b) => b.positionValue - a.positionValue);
  const top = sorted.slice(0, TOP);
  const rest = sorted.slice(TOP);
  const restValue = rest.reduce((sum, p) => sum + p.positionValue, 0);
  const restPct = rest.reduce((sum, p) => sum + p.allocationPct, 0);

  const data = [
    ...top.map((p, i) => ({ name: p.ticker, value: p.positionValue, allocationPct: p.allocationPct, color: COLORS[i], dot: LEGEND_BG_COLORS[i] })),
    ...(rest.length
      ? [{ name: `Otras ${rest.length}`, value: restValue, allocationPct: restPct, color: OTHERS_COLOR, dot: "bg-muted-foreground/45" }]
      : []),
  ];

  return (
    <section aria-labelledby="allocation-title" className="flex flex-col gap-3">
      <h2 id="allocation-title" className="text-base font-semibold text-foreground">
        Distribución
      </h2>

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
        <div className="h-[200px] w-full" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" dataKey="value" nameKey="name" paddingAngle={2} strokeWidth={0}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="flex flex-col gap-3">
          {data.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span aria-hidden className={`size-2 rounded-full shrink-0 ${d.dot}`} />
                <span className="text-sm font-mono font-semibold text-foreground truncate">{d.name}</span>
              </div>
              <span className="whitespace-nowrap text-xs font-mono font-semibold tabular-nums text-muted-foreground">
                {formatPct(d.allocationPct, { decimals: 1 })}
              </span>
            </li>
          ))}
        </ul>

        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-sm font-mono font-bold tabular-nums text-foreground">{formatARS(totalArs)}</span>
        </div>
      </div>
    </section>
  );
}
