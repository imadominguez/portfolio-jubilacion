import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PositionRow } from "@/lib/portfolio-data";
import type { PpmRow } from "@/app/actions/transactions";
import type { MarketPriceRow } from "@/app/actions/market-prices";
import { formatARS, formatUSD } from "@/lib/format";

interface HoldingsTableProps {
  positions: PositionRow[];
  ppmData?: PpmRow[];
  marketPrices?: MarketPriceRow[];
}

export function HoldingsTable({ positions, ppmData = [], marketPrices = [] }: HoldingsTableProps) {
  const max = Math.max(...positions.map((p) => p.positionValue));
  const ppmMap = new Map(ppmData.map((p) => [p.ticker, p]));
  const marketMap = new Map(marketPrices.map((m) => [m.ticker, m]));
  const hasPpm = ppmData.length > 0;

  const totalLiveUsd = marketPrices.length > 0
    ? positions.reduce((sum, pos) => {
        const market = marketMap.get(pos.ticker);
        if (!market || market.cedearRatio <= 0) return sum;
        return sum + (pos.quantity / market.cedearRatio) * market.priceUsd;
      }, 0)
    : null;

  const liveUsdFetchedAt = marketPrices.length > 0 ? marketPrices[0].fetchedAt : null;

  return (
    <section aria-labelledby="holdings-title" className="flex flex-col gap-3">
      <h2 id="holdings-title" className="text-base font-semibold text-foreground">
        Posiciones
      </h2>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/40">
              <TableHead className="pl-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground h-9">
                Activo
              </TableHead>
              <TableHead className="hidden sm:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground text-right h-9">
                Cantidad
              </TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground text-right h-9">
                Precio
              </TableHead>
              {hasPpm && (
                <TableHead className="hidden md:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground text-right h-9">
                  PPM / P&L
                </TableHead>
              )}
              <TableHead className="pr-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground text-right h-9">
                Valor
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => {
              const ppm = ppmMap.get(position.ticker);
              const market = marketMap.get(position.ticker);
              const unrealizedPnlPct =
                ppm && ppm.avgPrice > 0
                  ? ((position.price - ppm.avgPrice) / ppm.avgPrice) * 100
                  : null;
              const usdPositionValue =
                market && market.cedearRatio > 0
                  ? (position.quantity / market.cedearRatio) * market.priceUsd
                  : null;

              return (
                <TableRow
                  key={position.ticker}
                  className="border-border/60 transition-colors hover:bg-muted/30"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {position.ticker}
                      </span>
                      {/* En celular, cantidad y precio van debajo del ticker. */}
                      <span className="sm:hidden text-[11px] font-mono tabular-nums text-muted-foreground">
                        {position.quantity % 1 === 0 ? position.quantity.toFixed(0) : position.quantity.toFixed(2)} × {formatARS(position.price)}
                      </span>
                      {position.instrumentName && (
                        <span className="hidden sm:block text-[11px] text-muted-foreground leading-tight">
                          {position.instrumentName
                            .replace(/^CEDEAR\s+/i, "")
                            .replace(/\s*\([A-Z0-9]+\)\s*$/, "")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-3 text-right text-sm font-mono tabular-nums text-muted-foreground">
                    {position.quantity % 1 === 0
                      ? position.quantity.toFixed(0)
                      : position.quantity.toFixed(2)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-mono tabular-nums text-foreground/80">
                        {formatARS(position.price)}
                      </span>
                      {market && (
                        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                          {market.underlyingTicker} {formatUSD(market.priceUsd)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {hasPpm && (
                    <TableCell className="hidden md:table-cell py-3 text-right">
                      {ppm ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs font-mono tabular-nums text-muted-foreground">
                            PPM: {formatARS(ppm.avgPrice)}
                          </span>
                          {unrealizedPnlPct !== null && (
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                unrealizedPnlPct >= 0 ? "text-success" : "text-destructive"
                              }`}
                            >
                              {unrealizedPnlPct >= 0 ? "+" : ""}
                              {unrealizedPnlPct.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="pr-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-mono font-semibold tabular-nums text-foreground">
                        {formatARS(position.positionValue)}
                      </span>
                      {usdPositionValue !== null && (
                        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                          {formatUSD(usdPositionValue)}
                        </span>
                      )}
                      {unrealizedPnlPct !== null && (
                        <span
                          className={`md:hidden text-[11px] font-mono tabular-nums ${
                            unrealizedPnlPct >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {unrealizedPnlPct >= 0 ? "+" : ""}
                          {unrealizedPnlPct.toFixed(2)}% vs PPM
                        </span>
                      )}
                      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-chart-1/70"
                          style={{ width: `${(position.positionValue / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalLiveUsd !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {/* Los precios son los del último refresco (cron diario o botón), no en vivo. */}
            Precios del{" "}
            {liveUsdFetchedAt
              ? new Intl.DateTimeFormat("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "short",
                  timeZone: "America/Argentina/Buenos_Aires",
                }).format(liveUsdFetchedAt)
              : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Total con precios del día</span>
            <span className="text-sm font-mono font-semibold tabular-nums text-foreground">
              {formatUSD(totalLiveUsd)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
