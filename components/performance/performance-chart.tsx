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
import { formatARS, formatARSCompact, formatDateShort, formatUSD, formatUSDCompact } from "@/lib/format";

type Currency = "ARS" | "USD";

interface PerformanceChartProps {
  snapshots: SnapshotPoint[];
  // Moneda con la que arranca: la que se eligió para el resto de /performance.
  initialCurrency?: Currency;
}

const chartConfig = {
  value: {
    label: "Valor",
    color: "var(--color-chart-1)",
  },
};

export function PerformanceChart({ snapshots, initialCurrency = "ARS" }: PerformanceChartProps) {
  const [currency, setCurrency] = useState<Currency>(initialCurrency);

  const data = snapshots.map((s) => ({
    date: formatDateShort(s.snapshotDate),
    // Eje de tiempo real: con snapshots irregulares (años al principio, días al
    // final) un eje por categoría comprimía años y exageraba la pendiente.
    ts: new Date(s.snapshotDate).getTime(),
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
            aria-pressed={currency === c}
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
              tickFormatter={(v) =>
                currency === "ARS" ? formatARSCompact(v) : formatUSDCompact(v)
              }
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const ts = payload?.[0]?.payload?.ts;
                    return typeof ts === "number" ? formatDateShort(new Date(ts)) : "";
                  }}
                  formatter={(value) => (currency === "ARS" ? formatARS(Number(value)) : formatUSD(Number(value)))}
                />
              }
            />
            <Line
              // Recta entre snapshots: con puntos irregulares la curva inventaba picos.
              type="linear"
              dataKey="value"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-chart-1)", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
      {/* El SVG de Recharts no se lee con lector de pantalla: la misma serie en una tabla. */}
      <table className="sr-only">
        <caption>Valor del portfolio por snapshot, en {currency === "ARS" ? "pesos" : "dólares"}</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.value === null ? "sin dato" : currency === "ARS" ? formatARS(d.value) : formatUSD(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
