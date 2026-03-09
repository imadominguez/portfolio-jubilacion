"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ConcentrationData, ConcentrationItem } from "@/lib/analysis-data";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
];

type Tab = "sector" | "country" | "industry";

function formatARS(v: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(v);
}

interface ConcentrationChartProps {
  items: ConcentrationItem[];
  label: string;
}

function ConcentrationChart({ items, label }: ConcentrationChartProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
        Sin datos de {label.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
          >
            {items.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [formatARS(value), "Valor"]}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: 11, color: "var(--color-muted-foreground)" }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-col gap-1">
        {items.slice(0, 8).map((item, i) => (
          <div key={item.name} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-xs text-muted-foreground truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-foreground">
                {item.pct.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">{formatARS(item.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ConcentrationChartsProps {
  data: ConcentrationData;
}

export function ConcentrationCharts({ data }: ConcentrationChartsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("sector");

  const tabs: { id: Tab; label: string; items: ConcentrationItem[] }[] = [
    { id: "sector", label: "Sector", items: data.bySector },
    { id: "country", label: "País", items: data.byCountry },
    { id: "industry", label: "Industria", items: data.byIndustry },
  ];

  const active = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] text-muted-foreground/60">
              ({tab.items.length})
            </span>
          </button>
        ))}
      </div>

      <ConcentrationChart items={active.items} label={active.label} />

      {data.unclassified > 0 && (
        <p className="text-xs text-muted-foreground">
          * {formatARS(data.unclassified)} sin clasificar — completá el sector/país en la
          página de Assets para ver el análisis completo.
        </p>
      )}
    </div>
  );
}
