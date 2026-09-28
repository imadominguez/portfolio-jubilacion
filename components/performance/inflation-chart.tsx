"use client";

import { useState, useTransition } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download } from "lucide-react";
import type { SnapshotPoint } from "@/lib/portfolio-data";
import { fetchAndSaveCer, fetchAndSaveInflation, getIndexPoints } from "@/app/actions/indices";
import { INDEX_BENCHMARKS, type IndexBenchmarkId } from "@/lib/benchmarks-config";
import { formatDateShort } from "@/lib/format";

interface IndexPointProp {
  date: Date | string;
  normalizedValue: number | null;
}

interface InflationChartProps {
  snapshots: SnapshotPoint[];
  initialIndices: Record<IndexBenchmarkId, IndexPointProp[]>;
}

const chartConfig = {
  portfolio: { label: "Portfolio", color: "var(--color-chart-1)" },
  inflacion: { label: "Inflación (IPC)", color: "var(--color-chart-5)" },
  cer: { label: "CER (UVA)", color: "var(--color-chart-2)" },
};

type Row = {
  ts: number;
  label: string;
  portfolio?: number;
  inflacion?: number;
  cer?: number;
};

export function InflationChart({ snapshots, initialIndices }: InflationChartProps) {
  const [indices, setIndices] =
    useState<Record<IndexBenchmarkId, IndexPointProp[]>>(initialIndices);
  const [active, setActive] = useState<Set<IndexBenchmarkId>>(
    () =>
      new Set(
        (Object.keys(INDEX_BENCHMARKS) as IndexBenchmarkId[]).filter(
          (id) => (initialIndices[id]?.length ?? 0) > 0
        )
      )
  );
  const [logScale, setLogScale] = useState(true);
  const [isPending, startTransition] = useTransition();

  if (snapshots.length === 0) return null;

  const fromDate = new Date(snapshots[0].snapshotDate);
  const firstValue = snapshots[0].totalValueArs;

  function toggle(id: IndexBenchmarkId) {
    if (active.has(id)) {
      setActive((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    if (indices[id]?.length) {
      setActive((prev) => new Set([...prev, id]));
      return;
    }

    startTransition(async () => {
      const result =
        id === "inflacion"
          ? await fetchAndSaveInflation(fromDate)
          : await fetchAndSaveCer(fromDate);
      if (result.success) {
        const points = await getIndexPoints(id, fromDate);
        setIndices((prev) => ({ ...prev, [id]: points }));
        setActive((prev) => new Set([...prev, id]));
        toast.success(`${INDEX_BENCHMARKS[id].label}: ${result.saved} puntos cargados`);
      } else {
        toast.error(result.error);
      }
    });
  }

  // Eje temporal = unión de fechas de snapshots + índices activos, con forward-fill.
  const snapshotByTs = new Map<number, number>();
  for (const s of snapshots) {
    const ts = new Date(s.snapshotDate).getTime();
    snapshotByTs.set(ts, firstValue > 0 ? (s.totalValueArs / firstValue) * 100 : 100);
  }

  const indexByTs = new Map<IndexBenchmarkId, Map<number, number>>();
  for (const id of active) {
    const map = new Map<number, number>();
    for (const p of indices[id] ?? []) {
      if (p.normalizedValue === null) continue;
      map.set(new Date(p.date).getTime(), p.normalizedValue);
    }
    indexByTs.set(id, map);
  }

  const timestamps = new Set<number>(snapshotByTs.keys());
  for (const map of indexByTs.values()) {
    for (const ts of map.keys()) timestamps.add(ts);
  }

  let lastPortfolio: number | undefined;
  let lastInflacion: number | undefined;
  let lastCer: number | undefined;

  const chartData: Row[] = [];
  for (const ts of [...timestamps].sort((a, b) => a - b)) {
    const p = snapshotByTs.get(ts);
    if (p !== undefined) lastPortfolio = p;
    const inf = indexByTs.get("inflacion")?.get(ts);
    if (inf !== undefined) lastInflacion = inf;
    const cer = indexByTs.get("cer")?.get(ts);
    if (cer !== undefined) lastCer = cer;

    chartData.push({
      ts,
      label: formatDateShort(new Date(ts)),
      portfolio: lastPortfolio,
      inflacion: active.has("inflacion") ? lastInflacion : undefined,
      cer: active.has("cer") ? lastCer : undefined,
    });
  }

  const hasAny = chartData.some((r) => r.inflacion !== undefined || r.cer !== undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          Rendimiento real (base 100, ARS) · escala {logScale ? "logarítmica" : "lineal"}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.entries(INDEX_BENCHMARKS) as [IndexBenchmarkId, { label: string }][]).map(
            ([id, { label }]) => (
              <Button
                key={id}
                size="sm"
                variant={active.has(id) ? "default" : "outline"}
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => toggle(id)}
                disabled={isPending}
              >
                {isPending && !active.has(id) ? (
                  <Download className="size-3 animate-bounce" />
                ) : null}
                {label}
              </Button>
            )
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs"
            onClick={() => setLogScale((v) => !v)}
          >
            {logScale ? "Log" : "Lineal"}
          </Button>
        </div>
      </div>

      {!hasAny && (
        <p className="text-xs text-muted-foreground">
          Activá «Inflación (IPC)» o «CER (UVA)» para cargar los índices y comparar.
        </p>
      )}

      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              scale={logScale ? "log" : "linear"}
              domain={["auto", "auto"]}
              allowDataOverflow
              tickFormatter={(v) => `${Number(v).toFixed(0)}`}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}`,
                chartConfig[name as keyof typeof chartConfig]?.label ?? name,
              ]}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              iconType="line"
              iconSize={16}
              formatter={(value) => (
                <span style={{ fontSize: 11, color: "var(--color-muted-foreground)" }}>
                  {chartConfig[value as keyof typeof chartConfig]?.label ?? value}
                </span>
              )}
            />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke={chartConfig.portfolio.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            {active.has("inflacion") && (
              <Line
                type="monotone"
                dataKey="inflacion"
                stroke={chartConfig.inflacion.color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            )}
            {active.has("cer") && (
              <Line
                type="monotone"
                dataKey="cer"
                stroke={chartConfig.cer.color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
