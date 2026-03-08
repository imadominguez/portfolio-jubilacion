import { TrendingUp, TrendingDown } from "lucide-react";
import type { PositionRow } from "@/lib/portfolio-data";

interface PerformersPanelProps {
  currentPositions: PositionRow[];
  previousPositions: PositionRow[];
}

type TickerPerf = {
  ticker: string;
  pricePct: number;
  currentPrice: number;
  previousPrice: number;
};

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function PerformerCard({ item }: { item: TickerPerf }) {
  const isPositive = item.pricePct >= 0;

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card shadow-sm px-4 py-3 gap-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
            isPositive ? "bg-emerald-500/10" : "bg-destructive/10"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="size-4 text-emerald-500" />
          ) : (
            <TrendingDown className="size-4 text-destructive" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold font-mono text-foreground">
            {item.ticker}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {formatARS(item.currentPrice)}
          </span>
        </div>
      </div>

      <div
        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold tabular-nums shrink-0 ${
          isPositive
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-destructive/10 text-destructive"
        }`}
      >
        {isPositive ? "+" : ""}
        {item.pricePct.toFixed(2)}%
      </div>
    </div>
  );
}

export function PerformersPanel({
  currentPositions,
  previousPositions,
}: PerformersPanelProps) {
  const prevMap = new Map<string, number>(
    previousPositions.map((p) => [p.ticker, p.price])
  );

  const performers: TickerPerf[] = currentPositions
    .filter(
      (p) =>
        prevMap.has(p.ticker) &&
        (prevMap.get(p.ticker) ?? 0) > 0 &&
        p.price > 0
    )
    .map((p) => ({
      ticker: p.ticker,
      pricePct:
        ((p.price - prevMap.get(p.ticker)!) / prevMap.get(p.ticker)!) * 100,
      currentPrice: p.price,
      previousPrice: prevMap.get(p.ticker)!,
    }));

  if (performers.length < 2) return null;

  const sorted = [...performers].sort((a, b) => b.pricePct - a.pricePct);
  const topN = Math.min(3, Math.floor(sorted.length / 2));
  const best = sorted.slice(0, topN);
  const worst = sorted.slice(-topN).reverse();

  return (
    <section
      className="animate-fade-up grid gap-4 sm:grid-cols-2"
      style={{ animationDelay: "120ms" }}
    >
      <div>
        <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Mejor rendimiento
        </p>
        <div className="flex flex-col gap-2">
          {best.map((p) => (
            <PerformerCard key={p.ticker} item={p} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Peor rendimiento
        </p>
        <div className="flex flex-col gap-2">
          {worst.map((p) => (
            <PerformerCard key={p.ticker} item={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
