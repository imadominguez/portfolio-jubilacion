"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
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

interface ExchangeRatePoint {
  date: Date;
  ccl: number;
}

interface SnapshotPoint {
  snapshotDate: Date;
  totalValueArs: number;
  totalValueUsd: number | null;
  ccl: number | null;
}

interface CCLChartProps {
  rates: ExchangeRatePoint[];
  snapshots: SnapshotPoint[];
}

function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(dateStr + "T00:00:00"));
}

function formatCCL(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

const chartConfig = {
  ccl: {
    label: "CCL",
    color: "var(--color-chart-1)",
  },
  portfolioUsd: {
    label: "Portfolio USD",
    color: "var(--color-chart-2)",
  },
};

type ChartPoint = {
  date: string;
  dateLabel: string;
  ccl?: number;
  portfolioUsd?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-popover px-4 py-3 shadow-lg text-xs flex flex-col gap-2">
      <p className="font-semibold text-foreground font-mono">{label}</p>
      {payload.map(
        (entry: { name: string; value: number; color: string }) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">
              {entry.name === "ccl" ? "CCL" : "Portfolio USD"}:
            </span>
            <span className="font-mono font-semibold text-foreground">
              {entry.name === "ccl"
                ? formatCCL(entry.value)
                : formatUSD(entry.value)}
            </span>
          </div>
        )
      )}
    </div>
  );
}

export function CCLChart({ rates, snapshots }: CCLChartProps) {
  const [showPortfolio, setShowPortfolio] = useState(true);

  const hasPortfolioData = snapshots.some(
    (s) => s.totalValueUsd !== null || s.ccl !== null
  );

  const chartData = useMemo<ChartPoint[]>(() => {
    const dateMap = new Map<string, ChartPoint>();

    for (const rate of rates) {
      const dateKey =
        rate.date instanceof Date
          ? rate.date.toISOString().split("T")[0]
          : String(rate.date).split("T")[0];
      dateMap.set(dateKey, {
        date: dateKey,
        dateLabel: formatDateShort(dateKey),
        ccl: rate.ccl,
      });
    }

    for (const snapshot of snapshots) {
      const dateKey =
        snapshot.snapshotDate instanceof Date
          ? snapshot.snapshotDate.toISOString().split("T")[0]
          : String(snapshot.snapshotDate).split("T")[0];

      const usd =
        snapshot.totalValueUsd ??
        (snapshot.ccl ? snapshot.totalValueArs / snapshot.ccl : null);

      if (!usd) continue;

      const existing = dateMap.get(dateKey);
      if (existing) {
        existing.portfolioUsd = usd;
      } else {
        dateMap.set(dateKey, {
          date: dateKey,
          dateLabel: formatDateShort(dateKey),
          portfolioUsd: usd,
        });
      }
    }

    return [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [rates, snapshots]);

  // Show a subset of X-axis ticks to avoid overcrowding
  const tickCount = Math.min(chartData.length, 12);
  const tickStep = Math.max(1, Math.floor(chartData.length / tickCount));
  const xTicks = chartData
    .filter((_, i) => i % tickStep === 0)
    .map((d) => d.dateLabel);

  return (
    <div className="flex flex-col gap-4">
      {hasPortfolioData && (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant={showPortfolio ? "default" : "outline"}
            className="h-7 px-3 text-xs font-mono"
            onClick={() => setShowPortfolio((v) => !v)}
          >
            Overlay Portfolio USD
          </Button>
        </div>
      )}

      <ChartContainer config={chartConfig} className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              opacity={0.4}
            />
            <XAxis
              dataKey="dateLabel"
              ticks={xTicks}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            {/* Left axis: CCL */}
            <YAxis
              yAxisId="ccl"
              orientation="left"
              tickFormatter={(v) => formatCCL(v)}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            {/* Right axis: Portfolio USD */}
            {showPortfolio && hasPortfolioData && (
              <YAxis
                yAxisId="portfolio"
                orientation="right"
                tickFormatter={(v) => formatUSD(v)}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            {(showPortfolio && hasPortfolioData) && (
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) =>
                  value === "ccl" ? "CCL (ARS/$)" : "Portfolio USD"
                }
              />
            )}
            <Line
              yAxisId="ccl"
              type="monotone"
              dataKey="ccl"
              stroke="var(--color-chart-1)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
            />
            {showPortfolio && hasPortfolioData && (
              <Line
                yAxisId="portfolio"
                type="monotone"
                dataKey="portfolioUsd"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--color-chart-2)", strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
