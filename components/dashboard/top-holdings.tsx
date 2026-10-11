import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PositionRow } from "@/lib/portfolio-data";
import type { PpmRow } from "@/app/actions/transactions";
import { formatARS, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const TOP = 5;

// Las posiciones que más pesan, con su P&L contra el PPM. La tabla completa
// (cantidades, precios, PPM, USD) vive en /cartera: en el Dashboard era el
// bloque más grande y empujaba lo que importa para "¿voy bien?".
export function TopHoldings({ positions, ppmData }: { positions: PositionRow[]; ppmData: PpmRow[] }) {
  const ppm = new Map(ppmData.map((p) => [p.ticker, p.avgPrice]));
  const top = [...positions].sort((a, b) => b.positionValue - a.positionValue).slice(0, TOP);
  const rest = positions.length - top.length;

  return (
    <section aria-labelledby="top-holdings-title" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="top-holdings-title" className="text-base font-semibold text-foreground">
          Posiciones principales
        </h2>
        <Link
          href="/cartera"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          Ver la cartera completa
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
        {top.map((pos) => {
          const avg = ppm.get(pos.ticker);
          const pnl = avg && avg > 0 ? ((pos.price - avg) / avg) * 100 : null;
          return (
            <li key={pos.ticker} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="font-mono text-sm font-semibold text-foreground">{pos.ticker}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatPct(pos.allocationPct, { decimals: 1 })} del portfolio
                </span>
              </div>
              <div className="flex shrink-0 items-baseline gap-4">
                {pnl !== null && (
                  <span
                    className={cn(
                      "hidden font-mono text-xs tabular-nums sm:inline",
                      pnl >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatPct(pnl, { signed: true, decimals: 1 })} vs PPM
                  </span>
                )}
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatARS(pos.positionValue)}
                </span>
              </div>
            </li>
          );
        })}
        {rest > 0 && (
          <li className="px-5 py-2.5 text-xs text-muted-foreground">
            y {rest} {rest === 1 ? "posición más" : "posiciones más"} en la cartera
          </li>
        )}
      </ul>
    </section>
  );
}
