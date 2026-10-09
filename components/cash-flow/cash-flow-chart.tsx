"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { formatARS, formatARSCompact } from "@/lib/format";
import type { MonthCashFlow } from "@/lib/cash-flow";

const chartConfig = {
  deposits: { label: "Depósitos", color: "var(--color-chart-2)" },
  expenses: { label: "Gastos", color: "var(--color-chart-5)" },
  savingsRate: { label: "Tasa de ahorro", color: "var(--color-chart-1)" },
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const shortMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
};

export function CashFlowChart({ months }: { months: MonthCashFlow[] }) {
  const data = months.map((m) => ({
    month: shortMonth(m.monthKey),
    deposits: m.deposits,
    expenses: m.expenses,
    savingsRate: m.savingsRate,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="ars"
            tickFormatter={(v) => formatARSCompact(v)}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            content={
              <ChartTooltipContent
                formatter={(value, name) =>
                  name === "savingsRate"
                    ? `Tasa de ahorro: ${value === null ? "—" : `${Number(value).toFixed(0)}%`}`
                    : `${chartConfig[name as keyof typeof chartConfig]?.label}: ${formatARS(Number(value))}`
                }
              />
            }
          />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">
                {chartConfig[value as keyof typeof chartConfig]?.label ?? value}
              </span>
            )}
          />
          <Bar yAxisId="ars" dataKey="deposits" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="ars" dataKey="expenses" fill="var(--color-chart-5)" radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="pct"
            type="linear"
            dataKey="savingsRate"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: "var(--color-chart-1)" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
