"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type DcaMode,
  type DcaPosition,
  type DcaSignal,
} from "@/lib/dca-planner";

interface DcaPlannerClientProps {
  portfolioValueArs: number;
  ccl: number | null;
  positions: DcaPosition[];
  assets: DcaAssetInfo[];
  marketPrices: Record<string, number>;
  // Señales del último reporte de oportunidades; null si no hay ninguno.
  signals: Record<string, DcaSignal> | null;
  reportDate: string | null;
  // El reporte tiene más de 45 días: las señales pueden estar viejas.
  reportIsOld: boolean;
}

const DEFAULT_AMOUNT = 500_000;

const SIGNAL_STYLE: Record<DcaSignal["senal"], string> = {
  compra: "bg-success/15 text-success",
  mantener: "bg-muted text-muted-foreground",
  venta: "bg-destructive/15 text-destructive",
};

const MODE_TEXT: Record<DcaMode, string> = {
  compra: "El aporte va a las acciones marcadas \"compra\", más a las de mayor confianza (alta 3, media 2, baja 1).",
  mantener: "Ninguna acción está marcada \"compra\": el aporte se reparte en partes iguales entre las \"mantener\".",
  ninguna: "Todas las acciones con señal están marcadas \"venta\": el plan no asigna el aporte.",
  iguales: "Todavía no hay un reporte de oportunidades: el aporte se reparte en partes iguales entre tus CEDEARs.",
};

export function DcaPlannerClient({
  portfolioValueArs,
  ccl,
  positions,
  assets,
  marketPrices,
  signals,
  reportDate,
  reportIsOld,
}: DcaPlannerClientProps) {
  const [amount, setAmount] = useState<number>(DEFAULT_AMOUNT);

  const plan = useMemo(
    () =>
      planDca({
        monthlyAmountArs: Number.isFinite(amount) && amount > 0 ? amount : 0,
        portfolioValueArs,
        ccl,
        positions,
        assets,
        marketPrices,
        signals,
      }),
    [amount, portfolioValueArs, ccl, positions, assets, marketPrices, signals]
  );

  const head = "h-9 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70";

  return (
    <div className="flex flex-col gap-6">
      {reportIsOld && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <p>
            Las señales son del reporte del {reportDate}, de hace más de un mes y medio.{" "}
            <Link href="/portfolio" className="text-primary underline-offset-4 hover:underline">
              Generá un reporte nuevo
            </Link>{" "}
            para que el plan use precios y noticias recientes.
          </p>
        </div>
      )}

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
            <span className="text-xs text-warning">{formatARS(plan.unallocatedArs)} sin asignar</span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        {MODE_TEXT[plan.mode]}
        {reportDate && ` Señales del reporte del ${reportDate}.`}
      </p>

      {/* Plan */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/40">
              <TableHead className={`pl-4 ${head}`}>Ticker</TableHead>
              <TableHead className={head}>Señal</TableHead>
              <TableHead className={`${head} text-right`}>Actual</TableHead>
              <TableHead className={`${head} text-right`}>Comprar</TableHead>
              <TableHead className={`${head} text-right`}>CEDEARs</TableHead>
              <TableHead className={`pr-4 ${head} text-right`}>Nuevo %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.rows.map((row) => {
              const isBuy = row.amountArs > 0;
              return (
                <TableRow key={row.ticker} className={`border-border/60 ${isBuy ? "" : "opacity-55"}`}>
                  <TableCell className="pl-4 py-3">
                    <span className="text-sm font-bold font-mono text-foreground">{row.ticker}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    {row.signal ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${SIGNAL_STYLE[row.signal.senal]}`}>
                          {row.signal.senal}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{row.signal.confianza}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-foreground">
                    {row.currentPct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm font-mono font-semibold tabular-nums text-foreground">
                    {isBuy ? formatARS(row.amountArs) : "—"}
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">
                    {isBuy && row.estimatedCedears !== null ? row.estimatedCedears : "—"}
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
        Sin pesos objetivo ni topes por acción. Los CEDEARs son una estimación según el precio del snapshot (o el
        del subyacente y el CCL); el plan no considera comisiones.
      </p>
    </div>
  );
}
