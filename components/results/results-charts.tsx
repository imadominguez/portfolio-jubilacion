"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { formatDateShort, formatDateUTC } from "@/lib/format";
import { monthLabel } from "@/lib/local-date";
import type { MonthFlows, TickerResult } from "@/lib/ticker-results";
import { fmtCompact, fmtMoney, pick, type Currency } from "./results-format";

const TICK = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const GRID = <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />;

// ---------------------------------------------------------------------------
// Resultado por ticker: realizado + no realizado + dividendos, apilados con signo
// ---------------------------------------------------------------------------

const gainsConfig = {
  realized: { label: "Realizado (ventas)", color: "var(--color-chart-1)" },
  unrealized: { label: "No realizado", color: "var(--color-chart-2)" },
  dividends: { label: "Dividendos", color: "var(--color-chart-5)" },
};

export function GainsByTickerChart({ tickers, currency }: { tickers: TickerResult[]; currency: Currency }) {
  const data = tickers.map((t) => ({
    ticker: t.ticker,
    realized: pick(t.realized, currency) ?? 0,
    unrealized: pick(t.unrealized, currency) ?? 0,
    dividends: pick(t.dividends, currency) ?? 0,
    total: pick(t.total, currency),
  }));

  return (
    <ChartContainer config={gainsConfig} className="w-full" style={{ height: Math.max(220, data.length * 34 + 60) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          {GRID}
          <XAxis type="number" tickFormatter={(v) => fmtCompact(v, currency)} tick={TICK} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="ticker" tick={{ ...TICK, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} width={64} />
          <ReferenceLine x={0} stroke="var(--color-border)" />
          <Tooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload;
                  return p ? `${p.ticker} · total ${fmtMoney(p.total, currency)}` : "";
                }}
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{gainsConfig[name as keyof typeof gainsConfig]?.label}</span>
                    <span className="font-mono tabular-nums">{fmtMoney(Number(value), currency)}</span>
                  </div>
                )}
              />
            }
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => gainsConfig[v as keyof typeof gainsConfig]?.label} />
          <Bar dataKey="realized" stackId="g" fill="var(--color-chart-1)" />
          <Bar dataKey="unrealized" stackId="g" fill="var(--color-chart-2)" />
          <Bar dataKey="dividends" stackId="g" fill="var(--color-chart-5)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Compras y ventas por mes
// ---------------------------------------------------------------------------

const flowsConfig = {
  bought: { label: "Compras", color: "var(--color-success)" },
  sold: { label: "Ventas", color: "var(--color-destructive)" },
};

export function MonthlyFlowsChart({ monthly, currency }: { monthly: MonthFlows[]; currency: Currency }) {
  const data = monthly.map((m) => ({
    month: m.month,
    label: monthLabel(m.month),
    bought: pick(m.bought, currency) ?? 0,
    // Hacia abajo: lo que salió de la tenencia.
    sold: -(pick(m.sold, currency) ?? 0),
  }));

  return (
    <ChartContainer config={flowsConfig} className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} stackOffset="sign" margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          {GRID}
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} minTickGap={8} />
          <YAxis tickFormatter={(v) => fmtCompact(v, currency)} tick={TICK} tickLine={false} axisLine={false} width={72} />
          <ReferenceLine y={0} stroke="var(--color-border)" />
          <Tooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{flowsConfig[name as keyof typeof flowsConfig]?.label}</span>
                    <span className="font-mono tabular-nums">{fmtMoney(Math.abs(Number(value)), currency)}</span>
                  </div>
                )}
              />
            }
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => flowsConfig[v as keyof typeof flowsConfig]?.label} />
          <Bar dataKey="bought" stackId="f" fill="var(--color-success)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="sold" stackId="f" fill="var(--color-destructive)" radius={[0, 0, 3, 3]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Precio de un ticker con sus compras y ventas encima
// ---------------------------------------------------------------------------

const priceConfig = {
  price: { label: "Precio (snapshots)", color: "var(--color-chart-1)" },
  avgCost: { label: "Tu costo promedio", color: "var(--color-chart-4)" },
  buy: { label: "Compra", color: "var(--color-success)" },
  sell: { label: "Venta", color: "var(--color-destructive)" },
};

type PricePointRow = { ts: number; price?: number; avgCost?: number; buy?: number; sell?: number };

export function TickerPriceChart({ result, currency }: { result: TickerResult; currency: Currency }) {
  const byTs = new Map<number, PricePointRow>();
  const row = (ts: number) => {
    const r = byTs.get(ts) ?? { ts };
    byTs.set(ts, r);
    return r;
  };
  for (const p of result.prices) {
    const v = pick(p.unitPrice, currency);
    if (v !== null) row(new Date(p.date).getTime()).price = v;
  }
  for (const e of result.events) {
    const ts = new Date(e.date).getTime();
    const price = pick(e.unitPrice, currency);
    const r = row(ts);
    if (price !== null) r[e.type === "BUY" ? "buy" : "sell"] = price;
    const avg = e.avgCostAfter ? pick(e.avgCostAfter, currency) : null;
    if (avg !== null) r.avgCost = avg;
  }
  const data = [...byTs.values()].sort((a, b) => a.ts - b.ts);

  return (
    <ChartContainer config={priceConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          {GRID}
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ts: number) => formatDateShort(new Date(ts))}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v) => fmtCompact(v, currency)}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={72}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const ts = payload?.[0]?.payload?.ts;
                  return typeof ts === "number" ? formatDateUTC(new Date(ts)) : "";
                }}
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{priceConfig[name as keyof typeof priceConfig]?.label}</span>
                    <span className="font-mono tabular-nums">{fmtMoney(Number(value), currency)}</span>
                  </div>
                )}
              />
            }
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => priceConfig[v as keyof typeof priceConfig]?.label} />
          <Line type="linear" dataKey="price" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: "var(--color-chart-1)" }} connectNulls />
          <Line type="stepAfter" dataKey="avgCost" stroke="var(--color-chart-4)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
          <Scatter dataKey="buy" fill="var(--color-success)" shape="triangle" />
          <Scatter dataKey="sell" fill="var(--color-destructive)" shape="diamond" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Tenencia del ticker después de cada operación
// ---------------------------------------------------------------------------

const positionConfig = {
  position: { label: "Tenencia (CEDEARs)", color: "var(--color-chart-3)" },
};

export function TickerPositionChart({ result }: { result: TickerResult }) {
  const first = result.events[0];
  const data = [
    ...(first ? [{ ts: new Date(first.date).getTime() - 1, position: result.startQuantity }] : []),
    ...result.events.map((e) => ({ ts: new Date(e.date).getTime(), position: e.positionAfter })),
  ];

  return (
    <ChartContainer config={positionConfig} className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          {GRID}
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ts: number) => formatDateShort(new Date(ts))}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={72} allowDecimals={false} />
          <Tooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const ts = payload?.[0]?.payload?.ts;
                  return typeof ts === "number" ? formatDateUTC(new Date(ts)) : "";
                }}
              />
            }
          />
          <Line type="stepAfter" dataKey="position" stroke="var(--color-chart-3)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: "var(--color-chart-3)" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
