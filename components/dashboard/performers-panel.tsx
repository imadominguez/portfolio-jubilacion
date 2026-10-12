import type { PriceChange } from "@/lib/price-changes";
import { formatARS, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PerformersPanelProps {
  // Variaciones ya ajustadas por cambios de ratio (priceChangesBetween).
  changes: PriceChange[];
  // "09 oct 2026": fecha del snapshot contra el que se compara.
  sinceLabel: string;
}

// Variación del precio del CEDEAR entre los dos últimos snapshots. Es precio, no
// rendimiento: no descuenta aportes ni dividendos, y a corto plazo es ruido para
// una estrategia DCA, por eso vive en Rendimiento y no en el Dashboard.
export function PerformersPanel({ changes, sinceLabel }: PerformersPanelProps) {
  if (changes.length < 2) return null;

  const sorted = [...changes].sort((a, b) => b.pricePct - a.pricePct);
  const topN = Math.min(3, Math.floor(sorted.length / 2));
  const best = sorted.slice(0, topN);
  const worst = sorted.slice(-topN).reverse();

  return (
    <section aria-labelledby="performers-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="performers-title" className="text-base font-semibold text-foreground">
          Variación de precio desde el {sinceLabel}
        </h2>
        <p className="text-sm text-muted-foreground">
          Las que más subieron y bajaron entre los dos últimos snapshots. Es precio del CEDEAR, no rendimiento.
        </p>
      </div>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
        <PerformerList title="Más subieron" items={best} />
        <PerformerList title="Más bajaron" items={worst} />
      </div>
    </section>
  );
}

function PerformerList({ title, items }: { title: string; items: PriceChange[] }) {
  return (
    <div className="flex flex-col bg-card">
      <h3 className="px-5 pt-4 pb-2 text-sm text-muted-foreground">{title}</h3>
      <ul className="divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.ticker} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="font-mono text-sm font-semibold text-foreground">{item.ticker}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatARS(item.currentPrice)}</span>
            </div>
            <span
              className={cn(
                "font-mono text-sm font-semibold tabular-nums",
                item.pricePct >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatPct(item.pricePct, { signed: true })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
