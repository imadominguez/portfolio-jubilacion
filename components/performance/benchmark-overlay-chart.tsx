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
import { fetchAndSaveBenchmark, getBenchmarkPoints } from "@/app/actions/benchmarks";
import { BENCHMARKS } from "@/lib/benchmarks-config";
import type { BenchmarkId } from "@/lib/benchmarks-config";

interface BenchmarkPoint {
  date: Date;
  normalizedValue: number | null;
}

interface BenchmarkOverlayChartProps {
  snapshots: SnapshotPoint[];
  initialBenchmarks: Record<string, BenchmarkPoint[]>;
}

function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(date));
}

const chartConfig = {
  portfolio: { label: "Portfolio", color: "var(--color-chart-1)" },
  sp500: { label: "S&P 500", color: "var(--color-chart-2)" },
  merval: { label: "Merval", color: "var(--color-chart-3)" },
  nasdaq: { label: "NASDAQ", color: "var(--color-chart-4)" },
};

export function BenchmarkOverlayChart({
  snapshots,
  initialBenchmarks,
}: BenchmarkOverlayChartProps) {
  const [benchmarkData, setBenchmarkData] = useState(initialBenchmarks);
  const [activeBenchmarks, setActiveBenchmarks] = useState<Set<BenchmarkId>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (snapshots.length === 0) return null;

  const firstValue = snapshots[0].totalValueArs;

  const normalizedSnapshots = snapshots.map((s) => ({
    date: formatDateShort(s.snapshotDate),
    rawDate: new Date(s.snapshotDate),
    portfolio: firstValue > 0 ? (s.totalValueArs / firstValue) * 100 : 100,
  }));

  const buildChartData = () => {
    const dateToRow = new Map<string, Record<string, number>>();

    for (const s of normalizedSnapshots) {
      const key = s.date;
      dateToRow.set(key, { portfolio: s.portfolio, _ts: s.rawDate.getTime() });
    }

    for (const benchmarkId of activeBenchmarks) {
      const points = benchmarkData[benchmarkId] ?? [];
      for (const p of points) {
        if (p.normalizedValue === null) continue;
        const label = formatDateShort(p.date);
        if (dateToRow.has(label)) {
          dateToRow.get(label)![benchmarkId] = p.normalizedValue;
        }
      }
    }

    return Array.from(dateToRow.values()).sort((a, b) => a._ts - b._ts);
  };

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
    });
  }

  const chartData = buildChartData();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">Rendimiento normalizado (base 100)</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.entries(BENCHMARKS) as [BenchmarkId, { label: string }][]).map(
            ([id, { label }]) => (
              <Button
                key={id}
                size="sm"
                variant={activeBenchmarks.has(id) ? "default" : "outline"}
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => toggleBenchmark(id)}
                disabled={isPending}
              >
                {isPending && !activeBenchmarks.has(id) ? (
                  <Download className="size-3 animate-bounce" />
                ) : null}
                {label}
              </Button>
            )
          )}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              opacity={0.4}
            />
            <XAxis
              dataKey={(d) => {
                const entry = normalizedSnapshots.find((s) => s.portfolio === d.portfolio);
                return entry ? entry.date : "";
              }}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v.toFixed(0)}`}
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
            {activeBenchmarks.has("sp500") && (
              <Line
                type="monotone"
                dataKey="sp500"
                stroke={chartConfig.sp500.color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            )}
            {activeBenchmarks.has("merval") && (
              <Line
                type="monotone"
                dataKey="merval"
                stroke={chartConfig.merval.color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            )}
            {activeBenchmarks.has("nasdaq") && (
              <Line
                type="monotone"
                dataKey="nasdaq"
                stroke={chartConfig.nasdaq.color}
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
