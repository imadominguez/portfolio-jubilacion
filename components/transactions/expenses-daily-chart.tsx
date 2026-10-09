"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { formatARS, formatARSCompact } from "@/lib/format";
import type { ExpenseDay } from "@/lib/expenses";

const chartConfig = {
  total: { label: "Gastado", color: "var(--color-chart-1)" },
};

export function ExpensesDailyChart({ days }: { days: ExpenseDay[] }) {
  const data = days.map((d) => ({ day: String(d.day), total: d.total, count: d.count }));

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
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
                labelFormatter={(label) => `Día ${label}`}
                formatter={(value, _name, item) =>
                  `${formatARS(Number(value))} · ${item.payload.count} ${item.payload.count === 1 ? "pago" : "pagos"}`
                }
              />
            }
          />
          <Bar dataKey="total" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
