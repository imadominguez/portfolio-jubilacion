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

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface HoldingsTableProps {
  positions: PositionRow[];
  ppmData?: PpmRow[];
}

export function HoldingsTable({ positions, ppmData = [] }: HoldingsTableProps) {
  const max = Math.max(...positions.map((p) => p.positionValue));
  const ppmMap = new Map(ppmData.map((p) => [p.ticker, p]));
  const hasPpm = ppmData.length > 0;

  return (
    <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
      <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Posiciones
      </p>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/40">
              <TableHead className="pl-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                Activo
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                Cantidad
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                Precio
              </TableHead>
              {hasPpm && (
                <TableHead className="hidden lg:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  PPM / P&L
                </TableHead>
              )}
              <TableHead className="pr-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                Valor
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position, index) => {
              const ppm = ppmMap.get(position.ticker);
              const unrealizedPnlPct =
                ppm && ppm.currency === "ARS" && ppm.avgPrice > 0
                  ? ((position.price - ppm.avgPrice) / ppm.avgPrice) * 100
                  : null;

              return (
                <TableRow
                  key={position.ticker}
                  className="border-border/60 transition-colors animate-fade-up hover:bg-muted/30"
                  style={{ animationDelay: `${220 + index * 35}ms` }}
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {position.ticker}
                      </span>
                      {position.instrumentName && (
                        <span className="text-[11px] text-muted-foreground leading-tight">
                          {position.instrumentName
                            .replace(/^CEDEAR\s+/i, "")
                            .replace(/\s*\([A-Z0-9]+\)\s*$/, "")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm font-mono tabular-nums text-muted-foreground">
                    {position.quantity % 1 === 0
                      ? position.quantity.toFixed(0)
                      : position.quantity.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm font-mono tabular-nums text-foreground/80">
                    {formatARS(position.price)}
                  </TableCell>
                  {hasPpm && (
                    <TableCell className="hidden lg:table-cell py-3 text-right">
                      {ppm ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs font-mono tabular-nums text-muted-foreground">
                            PPM: {formatARS(ppm.avgPrice)}
                          </span>
                          {unrealizedPnlPct !== null && (
                            <span
                              className={`text-xs font-mono tabular-nums ${
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
                  <TableCell className="pr-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-mono font-semibold tabular-nums text-foreground">
                        {formatARS(position.positionValue)}
                      </span>
                      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
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
  );
}
