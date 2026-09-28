"use client";

import { useMemo, useState } from "react";
import { Wallet, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatARS } from "@/lib/format";
import {
  planDca,
  type DcaAssetInfo,
  type DcaPosition,
  type DcaTarget,
} from "@/lib/dca-planner";

interface DcaPlannerClientProps {
  portfolioValueArs: number;
  ccl: number | null;
  positions: DcaPosition[];
  targets: DcaTarget[];
  assets: DcaAssetInfo[];
  marketPrices: Record<string, number>;
}

const DEFAULT_AMOUNT = 500_000;

export function DcaPlannerClient({
  portfolioValueArs,
  ccl,
  positions,
  targets,
  assets,
  marketPrices,
}: DcaPlannerClientProps) {
  const [amount, setAmount] = useState<number>(DEFAULT_AMOUNT);

  const plan = useMemo(
    () =>
      planDca({
        monthlyAmountArs: Number.isFinite(amount) && amount > 0 ? amount : 0,
        portfolioValueArs,
        ccl,
        positions,
        targets,
        assets,
        marketPrices,
      }),
    [amount, portfolioValueArs, ccl, positions, targets, assets, marketPrices]
  );

  const activeRows = plan.rows.filter((r) => r.amountArs > 0);
  const skippedRows = plan.rows.filter((r) => r.amountArs === 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Control de aporte */}
      <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dca-amount" className="text-xs font-medium text-muted-foreground">
            Aporte mensual (ARS)
          </Label>
          <Input
            id="dca-amount"
            type="number"
            min={0}
            step={10_000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full sm:w-56 font-mono tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-0.5 sm:text-right">
          <span className="text-xs text-muted-foreground">A asignar</span>
          <span className="text-xl font-bold font-mono tabular-nums text-foreground">
            {formatARS(plan.totalAllocatedArs)}
          </span>
          {plan.unallocatedArs > 0 && (
            <span className="text-xs text-warning">
              {formatARS(plan.unallocatedArs)} sin asignar (posiciones en objetivo)
            </span>
          )}
        </div>
      </div>

      {/* Plan */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/40">
              <TableHead className="pl-4 h-9 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70">
                Ticker
              </TableHead>
              <TableHead className="h-9 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right">
                Objetivo
              </TableHead>
              <TableHead className="h-9 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right">
                Actual
              </TableHead>
              <TableHead className="h-9 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right">
                Desvío
              </TableHead>
              <TableHead className="h-9 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right">
                Comprar
              </TableHead>
              <TableHead className="h-9 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right">
                CEDEARs
              </TableHead>
              <TableHead className="pr-4 h-9 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right">
                Nuevo %
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...activeRows, ...skippedRows].map((row) => {
              const deviation = row.currentPct - row.targetPct;
              const Icon = deviation < -1 ? TrendingUp : deviation > 1 ? TrendingDown : Minus;
              const devColor =
                deviation < -1
                  ? "text-warning"
                  : deviation > 1
                    ? "text-destructive"
                    : "text-muted-foreground";
              const isBuy = row.amountArs > 0;

              return (
                <TableRow
                  key={row.ticker}
                  className={`border-border/60 ${isBuy ? "" : "opacity-55"}`}
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {row.ticker}
                      </span>
                      {isBuy ? (
                        <Badge className="bg-success/10 text-success border-transparent text-[10px]">
                          comprar
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-transparent text-[10px]">
                          en objetivo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">
                    {row.targetPct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-foreground">
                    {row.currentPct.toFixed(1)}%
                  </TableCell>
                  <TableCell className={`py-3 text-right text-xs font-mono tabular-nums ${devColor}`}>
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Icon className="size-3" />
                      {deviation >= 0 ? "+" : ""}
                      {deviation.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm font-mono font-semibold tabular-nums text-foreground">
                    {isBuy ? formatARS(row.amountArs) : "—"}
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">
                    {isBuy && row.estimatedCedears !== null
                      ? row.estimatedCedears
                      : "—"}
                  </TableCell>
                  <TableCell className="pr-4 py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">
                    {row.newPct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
        <Wallet className="size-3.5 shrink-0 mt-0.5" />
        Cálculo determinista (sin IA): reparte el aporte proporcional al faltante
        para llegar al peso objetivo, sin comprar posiciones que ya lo alcanzaron.
        Los CEDEARs son una estimación según el precio actual del subyacente y el CCL.
      </p>
    </div>
  );
}
