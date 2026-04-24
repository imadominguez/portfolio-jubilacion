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

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

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
    <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
      <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Posiciones
      </p>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-muted/40">
                <TableHead className="pl-3 sm:pl-4 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9 whitespace-nowrap">
                  Activo
                </TableHead>
                <TableHead className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9 whitespace-nowrap">
                  Cantidad
                </TableHead>
                <TableHead className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9 whitespace-nowrap">
                  Precio
                </TableHead>
                {hasPpm && (
                  <TableHead className="hidden md:table-cell text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9 whitespace-nowrap">
                    PPM / P&L
                  </TableHead>
                )}
                <TableHead className="pr-3 sm:pr-4 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9 whitespace-nowrap">
                  Valor
                </TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {positions.map((position, index) => {
              const ppm = ppmMap.get(position.ticker);
              const market = marketMap.get(position.ticker);
              const unrealizedPnlPct =
                ppm && ppm.currency === "ARS" && ppm.avgPrice > 0
                  ? ((position.price - ppm.avgPrice) / ppm.avgPrice) * 100
                  : null;
              const usdPositionValue =
                market && market.cedearRatio > 0
                  ? (position.quantity / market.cedearRatio) * market.priceUsd
                  : null;

              return (
                <TableRow
                  key={position.ticker}
                  className="border-border/60 transition-colors animate-fade-up hover:bg-muted/30"
                  style={{ animationDelay: `${220 + index * 35}ms` }}
                >
                  <TableCell className="pl-3 sm:pl-4 py-2 sm:py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs sm:text-sm font-bold font-mono text-foreground">
                        {position.ticker}
                      </span>
                      {position.instrumentName && (
                        <span className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight max-w-[120px] sm:max-w-none truncate">
                          {position.instrumentName
                            .replace(/^CEDEAR\s+/i, "")
                            .replace(/\s*\([A-Z0-9]+\)\s*$/, "")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 sm:py-3 text-right text-xs sm:text-sm font-mono tabular-nums text-muted-foreground">
                    {position.quantity % 1 === 0
                      ? position.quantity.toFixed(0)
                      : position.quantity.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-2 sm:py-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs sm:text-sm font-mono tabular-nums text-foreground/80">
                        {formatARS(position.price)}
                      </span>
                      {market && (
                        <span className="text-[10px] sm:text-[11px] font-mono tabular-nums text-muted-foreground/60">
                          {market.underlyingTicker} {formatUSD(market.priceUsd)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {hasPpm && (
                    <TableCell className="hidden md:table-cell py-2 sm:py-3 text-right">
                      {ppm ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[10px] sm:text-xs font-mono tabular-nums text-muted-foreground">
                            PPM: {formatARS(ppm.avgPrice)}
                          </span>
                          {unrealizedPnlPct !== null && (
                            <span
                              className={`text-[10px] sm:text-xs font-mono tabular-nums ${
                                unrealizedPnlPct >= 0 ? "text-emerald-500" : "text-destructive"
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
                  <TableCell className="pr-3 sm:pr-4 py-2 sm:py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs sm:text-sm font-mono font-semibold tabular-nums text-foreground">
                        {formatARS(position.positionValue)}
                      </span>
                      {usdPositionValue !== null && (
                        <span className="text-[10px] sm:text-[11px] font-mono tabular-nums text-muted-foreground/70">
                          {formatUSD(usdPositionValue)}
                        </span>
                      )}
                      <div className="h-1 w-12 sm:w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-chart-1/70 transition-all duration-700"
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
      </div>

      {totalLiveUsd !== null && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <span className="text-[10px] sm:text-[11px] text-muted-foreground/60">
            Precios en tiempo real ·{" "}
            {liveUsdFetchedAt
              ? new Intl.DateTimeFormat("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "short",
                }).format(liveUsdFetchedAt)
              : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] sm:text-[11px] text-muted-foreground/60">Total live</span>
            <span className="text-xs sm:text-sm font-mono font-semibold tabular-nums text-foreground">
              {formatUSD(totalLiveUsd)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
