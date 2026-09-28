import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatARS, formatUSD } from "@/lib/format";
import type { RealGainsSummary } from "@/lib/real-gains-data";
import { fmtPct, signColor } from "./real-gains-helpers";

export function PositionsTable({ summary }: { summary: RealGainsSummary }) {
  const hasStockData = summary.positions.some((p) => p.stockPriceAvailable);
  const incompletePositions = summary.positions.filter((p) => p.missingReason !== null);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-fade-up">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-muted/40">
            <TableHead className="pl-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
              Ticker
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              Costo ARS
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              Costo USD
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              Valor USD actual
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              Gan. USD real
            </TableHead>
            {hasStockData && (
              <>
                <TableHead className="hidden xl:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Apreciación
                </TableHead>
                <TableHead className="hidden xl:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Impacto CCL
                </TableHead>
              </>
            )}
            <TableHead className="pr-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              % ARS
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.positions.map((pos, i) => (
            <TableRow
              key={pos.ticker}
              className="border-border/60 hover:bg-muted/30 transition-colors animate-fade-up"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <TableCell className="pl-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold font-mono text-foreground">
                    {pos.ticker}
                  </span>
                  {pos.underlyingTicker && (
                    <span className="text-[11px] text-muted-foreground">
                      {pos.underlyingTicker}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">
                {formatARS(pos.costArs)}
              </TableCell>
              <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">
                {pos.costUsdCcl !== null ? formatUSD(pos.costUsdCcl) : "—"}
                {pos.cclApproximate && pos.costUsdCcl !== null && (
                  <span className="ml-1 text-[10px] text-warning">~</span>
                )}
              </TableCell>
              <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-foreground">
                {pos.valueUsdCcl !== null ? formatUSD(pos.valueUsdCcl) : "—"}
              </TableCell>
              <TableCell className="py-3 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={`text-sm font-mono font-semibold tabular-nums ${signColor(pos.gainUsdReal)}`}
                  >
                    {pos.gainUsdReal !== null ? formatUSD(pos.gainUsdReal) : "—"}
                  </span>
                  {pos.gainPctUsdReal !== null && (
                    <span
                      className={`text-[11px] font-mono tabular-nums ${signColor(pos.gainPctUsdReal)}`}
                    >
                      {fmtPct(pos.gainPctUsdReal)}
                    </span>
                  )}
                </div>
              </TableCell>
              {hasStockData && (
                <>
                  <TableCell className="hidden xl:table-cell py-3 text-right">
                    {pos.gainUsdAppreciation !== null ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={`text-xs font-mono tabular-nums ${signColor(pos.gainUsdAppreciation)}`}
                        >
                          {formatUSD(pos.gainUsdAppreciation)}
                        </span>
                        {pos.gainPctUsdAppreciation !== null && (
                          <span
                            className={`text-[10px] font-mono tabular-nums ${signColor(pos.gainPctUsdAppreciation)}`}
                          >
                            {fmtPct(pos.gainPctUsdAppreciation)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell py-3 text-right">
                    {pos.gainUsdCclImpact !== null ? (
                      <span
                        className={`text-xs font-mono tabular-nums ${signColor(pos.gainUsdCclImpact)}`}
                      >
                        {formatUSD(pos.gainUsdCclImpact)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                </>
              )}
              <TableCell className="pr-4 py-3 text-right">
                <span
                  className={`text-sm font-mono font-semibold tabular-nums ${signColor(pos.gainPctArs)}`}
                >
                  {fmtPct(pos.gainPctArs)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Footer con totales */}
      <div className="border-t border-border bg-muted/20 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Cobertura:{" "}
            <span className="font-semibold text-foreground">
              {summary.positionsWithFullData}/{summary.positionsTotal}
            </span>{" "}
            posiciones con datos completos
          </span>
          <span>
            CCL:{" "}
            <span className="font-semibold text-foreground">
              {summary.cclCoverage.toFixed(0)}%
            </span>{" "}
            de transacciones
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span className="text-muted-foreground">Total USD real:</span>
          <span
            className={`font-bold text-sm ${signColor(summary.totalGainUsdReal)}`}
          >
            {summary.totalGainUsdReal !== null ? formatUSD(summary.totalGainUsdReal) : "—"}
          </span>
        </div>
      </div>

      {/* Panel de diagnóstico para posiciones incompletas */}
      {incompletePositions.length > 0 && (
        <div className="border-t border-warning/20 bg-warning/5 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-3.5 text-warning shrink-0" />
            <span className="text-xs font-semibold text-warning">
              {incompletePositions.length}{" "}
              {incompletePositions.length === 1 ? "posición sin" : "posiciones sin"} datos
              completos — no se incluyen en apreciación ni impacto CCL
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {incompletePositions.map((pos) => (
              <div key={pos.ticker} className="flex items-start gap-3 pl-1">
                <span className="text-xs font-bold font-mono text-foreground w-16 shrink-0 mt-0.5">
                  {pos.ticker}
                </span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {pos.missingReason}
                  </span>
                  {pos.missingReason?.includes("underlyingTicker") && (
                    <a
                      href="/assets"
                      className="inline-flex items-center gap-1 text-[11px] text-warning hover:underline w-fit"
                    >
                      Configurar en Assets
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  {pos.missingReason?.includes("wizard") && (
                    <span className="text-[11px] text-warning">
                      Usá el botón &ldquo;Actualizar datos&rdquo; del header para recargar precios
                    </span>
                  )}
                  {pos.missingReason?.includes("Assets") && !pos.missingReason?.includes("underlyingTicker") && (
                    <a
                      href="/assets"
                      className="inline-flex items-center gap-1 text-[11px] text-warning hover:underline w-fit"
                    >
                      Actualizar precios en Assets
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
