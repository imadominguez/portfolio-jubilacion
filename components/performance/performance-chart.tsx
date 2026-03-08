"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import type { SnapshotPoint } from "@/lib/portfolio-data";

type Currency = "ARS" | "USD";

interface PerformanceChartProps {
  snapshots: SnapshotPoint[];
}

function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(date));
}

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
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
  value: {
    label: "Valor",
    color: "var(--color-chart-1)",
  },
};

export function PerformanceChart({ snapshots }: PerformanceChartProps) {
  const [currency, setCurrency] = useState<Currency>("ARS");

  const data = snapshots.map((s) => ({
    date: formatDateShort(s.snapshotDate),
    value:
      currency === "ARS"
        ? s.totalValueArs
        : (s.totalValueUsd ?? (s.ccl ? s.totalValueArs / s.ccl : null)),
    rawDate: s.snapshotDate,
  }));

  const hasUsdData = snapshots.some((s) => s.totalValueUsd !== null || s.ccl !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        {(["ARS", "USD"] as Currency[]).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={currency === c ? "default" : "outline"}
            className="h-7 px-3 text-xs font-mono"
            onClick={() => setCurrency(c)}
            disabled={c === "USD" && !hasUsdData}
          >
            {c}
          </Button>
        ))}
      </div>

      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              opacity={0.4}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) =>
                currency === "ARS" ? formatARS(v) : formatUSD(v)
              }
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    currency === "ARS"
                      ? new Intl.NumberFormat("es-AR", {
                          style: "currency",
                          currency: "ARS",
                          minimumFractionDigits: 0,
                        }).format(Number(value))
                      : new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          minimumFractionDigits: 0,
                        }).format(Number(value))
                  }
                />
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-chart-1)", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
