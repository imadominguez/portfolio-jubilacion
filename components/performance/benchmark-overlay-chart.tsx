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
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { SnapshotPoint } from "@/lib/portfolio-data";
import { fetchAndSaveBenchmark, getBenchmarkPoints } from "@/app/actions/benchmarks";
import { BENCHMARKS } from "@/lib/benchmarks-config";
import { formatDateShort } from "@/lib/format";
import type { BenchmarkId } from "@/lib/benchmarks-config";
import { cn } from "@/lib/utils";

interface BenchmarkPoint {
  date: Date;
  normalizedValue: number | null;
}

interface BenchmarkOverlayChartProps {
  snapshots: SnapshotPoint[];
  // Índice base 100 del portfolio sin aportes (TWR), alineado con `snapshots`.
  // Sin él se normaliza el valor, que sube con cada compra (ADR-0019).
  portfolioIndex?: Array<number | null>;
  initialBenchmarks: Record<string, BenchmarkPoint[]>;
}

const chartConfig = {
  portfolio: { label: "Portfolio", color: "var(--color-chart-1)" },
  sp500: { label: "S&P 500", color: "var(--color-chart-2)" },
  merval: { label: "Merval", color: "var(--color-chart-3)" },
  nasdaq: { label: "NASDAQ", color: "var(--color-chart-4)" },
};

type Row = { ts: number } & Partial<Record<"portfolio" | BenchmarkId, number>>;

const formatIndex = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 1 });

export function BenchmarkOverlayChart({
  snapshots,
  portfolioIndex,
  initialBenchmarks,
}: BenchmarkOverlayChartProps) {
  const [benchmarkData, setBenchmarkData] = useState(initialBenchmarks);
  const [activeBenchmarks, setActiveBenchmarks] = useState<Set<BenchmarkId>>(new Set());
  const [loadingId, setLoadingId] = useState<BenchmarkId | null>(null);
  const [isPending, startTransition] = useTransition();

  if (snapshots.length === 0) return null;

  const firstValue = snapshots[0].totalValueArs;

  // Una fila por fecha en milisegundos. Antes el eje era por categoría y los
  // benchmarks solo aparecían en los días con snapshot: un año entre dos
  // snapshots ocupaba lo mismo que una semana y el índice se dibujaba con saltos.
  const rows = new Map<number, Row>();
  const rowAt = (ts: number) => {
    let row = rows.get(ts);
    if (!row) rows.set(ts, (row = { ts }));
    return row;
  };

  snapshots.forEach((s, i) => {
    const portfolio = portfolioIndex
      ? portfolioIndex[i]
      : firstValue > 0
        ? (s.totalValueArs / firstValue) * 100
        : 100;
    if (portfolio === null || portfolio === undefined) return;
    rowAt(new Date(s.snapshotDate).getTime()).portfolio = portfolio;
  });

  for (const id of activeBenchmarks) {
    for (const p of benchmarkData[id] ?? []) {
      if (p.normalizedValue === null) continue;
      rowAt(new Date(p.date).getTime())[id] = p.normalizedValue;
    }
  }

  const chartData = [...rows.values()].sort((a, b) => a.ts - b.ts);

  function toggleBenchmark(id: BenchmarkId) {
    if (activeBenchmarks.has(id)) {
      setActiveBenchmarks((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    if (benchmarkData[id]?.length) {
      setActiveBenchmarks((prev) => new Set([...prev, id]));
      return;
    }

    const fromDate = new Date(snapshots[0].snapshotDate);
    setLoadingId(id);
    startTransition(async () => {
      const result = await fetchAndSaveBenchmark(id, fromDate);
      if (result.success) {
        const points = await getBenchmarkPoints(id, fromDate);
        setBenchmarkData((prev) => ({ ...prev, [id]: points }));
        setActiveBenchmarks((prev) => new Set([...prev, id]));
        toast.success(`${BENCHMARKS[id].label}: ${result.saved} puntos cargados`);
      } else {
        toast.error(result.error);
      }
      setLoadingId(null);
    });
  }

  const benchmarkIds = Object.keys(BENCHMARKS) as BenchmarkId[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: chartConfig.portfolio.color }} />
          Portfolio, base 100 al primer snapshot
        </p>
        {/* Cada botón lleva el color de su línea: así hace de leyenda y se ve cuál
            está prendido sin depender solo del relleno. */}
        <div role="group" aria-label="Benchmarks para comparar" className="flex items-center gap-1.5 flex-wrap">
          {benchmarkIds.map((id) => {
            const active = activeBenchmarks.has(id);
            return (
              <Button
                key={id}
                size="sm"
                variant="outline"
                aria-pressed={active}
                className={cn(
                  "h-7 px-2.5 text-xs gap-1.5",
                  active ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground"
                )}
                onClick={() => toggleBenchmark(id)}
                disabled={isPending}
              >
                {loadingId === id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <span
                    aria-hidden
                    className={cn("h-0.5 w-3 rounded-full transition-opacity", !active && "opacity-40")}
                    style={{ background: chartConfig[id].color }}
                  />
                )}
                {BENCHMARKS[id].label}
              </Button>
            );
          })}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ts: number) => formatDateShort(new Date(ts))}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => v.toFixed(0)}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(ts: number) => formatDateShort(new Date(ts))}
              formatter={(value: number, name: string) => [
                formatIndex(value),
                chartConfig[name as keyof typeof chartConfig]?.label ?? name,
              ]}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {/* Recta entre snapshots, como en Evolución: la curva suavizada dibujaba
                picos que no existieron. connectNulls porque los días de benchmark no
                tienen valor de portfolio. */}
            <Line
              type="linear"
              dataKey="portfolio"
              stroke={chartConfig.portfolio.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
            {benchmarkIds
              .filter((id) => activeBenchmarks.has(id))
              .map((id) => (
                <Line
                  key={id}
                  type="linear"
                  dataKey={id}
                  stroke={chartConfig[id].color}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      <table className="sr-only">
        <caption>Portfolio y benchmarks, base 100</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Portfolio</th>
          </tr>
        </thead>
        <tbody>
          {chartData
            .filter((r) => r.portfolio !== undefined)
            .map((r) => (
              <tr key={r.ts}>
                <td>{formatDateShort(new Date(r.ts))}</td>
                <td>{formatIndex(r.portfolio!)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
