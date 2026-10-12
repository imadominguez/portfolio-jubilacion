"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { formatARS, formatARSCompact, formatPct } from "@/lib/format";
import type { MonthCashFlow } from "@/lib/cash-flow";

const chartConfig = {
  deposits: { label: "Depósitos", color: "var(--color-chart-2)" },
  expenses: { label: "Gastos", color: "var(--color-chart-5)" },
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const shortMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
};

// Solo pesos en el eje. Antes la tasa de ahorro iba como línea sobre un segundo
// eje en %, y dos escalas en el mismo gráfico invitan a comparar alturas que no
// se comparan. La tasa está en los KPIs y en la tabla; acá va en el tooltip.
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
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={(v) => formatARSCompact(v)}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            content={
              <ChartTooltipContent
                labelFormatter={(label, payload) => {
                  const rate = payload?.[0]?.payload?.savingsRate as number | null | undefined;
                  return rate === null || rate === undefined
                    ? label
                    : `${label} · ahorro ${formatPct(rate, { decimals: 0 })}`;
                }}
                formatter={(value, name) =>
                  `${chartConfig[name as keyof typeof chartConfig]?.label}: ${formatARS(Number(value))}`
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
          <Bar dataKey="deposits" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" fill="var(--color-chart-5)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
