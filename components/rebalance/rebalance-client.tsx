"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { RebalanceRow, TargetAllocationRow } from "@/app/actions/rebalance";
import { upsertTargetAllocation, deleteTargetAllocation } from "@/app/actions/rebalance";

interface RebalanceClientProps {
  rebalanceData: RebalanceRow[];
  targets: TargetAllocationRow[];
  totalPct: number;
}

function formatARS(v: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(v);
}

export function RebalanceClient({ rebalanceData, targets, totalPct }: RebalanceClientProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [targetPct, setTargetPct] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await upsertTargetAllocation(ticker, parseFloat(targetPct));
      if (result.success) {
        toast.success(`Objetivo para ${ticker.toUpperCase()} guardado`);
        setTicker("");
        setTargetPct("");
        setAddOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string, ticker: string) {
    startTransition(async () => {
      const result = await deleteTargetAllocation(id);
      if (result.success) {
        toast.success(`Objetivo de ${ticker} eliminado`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const isOverAllocated = totalPct > 100.5;
  const isUnderAllocated = totalPct < 99.5 && targets.length > 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Asignación objetivo
          </p>
          {targets.length > 0 && (
            <Badge
              variant={isOverAllocated ? "destructive" : isUnderAllocated ? "secondary" : "default"}
              className="text-[10px] h-5"
            >
              Total: {totalPct.toFixed(1)}%
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="size-3" />
          Agregar objetivo
        </Button>
      </div>

      {rebalanceData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card shadow-sm flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm font-medium text-foreground">Sin datos de rebalanceo</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Configurá la asignación objetivo para cada ticker para ver las
            recomendaciones de rebalanceo.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-muted/40">
                <TableHead className="pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                  Ticker
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Actual
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Objetivo
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Desviación
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Valor actual
                </TableHead>
                <TableHead className="pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rebalanceData.map((row) => (
                <TableRow key={row.ticker} className="border-border hover:bg-muted/30">
                  <TableCell className="pl-5 py-3.5">
                    <span className="text-sm font-mono font-medium text-foreground">
                      {row.ticker}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <span className="text-sm font-mono tabular-nums text-foreground">
                      {row.currentPct.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <span className="text-sm font-mono tabular-nums text-muted-foreground">
                      {row.targetPct > 0 ? `${row.targetPct.toFixed(1)}%` : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <span
                      className={`text-sm font-mono tabular-nums ${
                        Math.abs(row.deviation) <= 1
                          ? "text-muted-foreground"
                          : row.deviation > 0
                            ? "text-amber-500"
                            : "text-blue-500"
                      }`}
                    >
                      {row.deviation > 0 ? "+" : ""}
                      {row.deviation.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <span className="text-sm font-mono tabular-nums text-muted-foreground">
                      {formatARS(row.currentValue)}
                    </span>
                  </TableCell>
                  <TableCell className="pr-5 py-3.5">
                    {row.suggestedAction === "BUY" && (
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="size-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-500 font-medium">Comprar</span>
                      </div>
                    )}
                    {row.suggestedAction === "SELL" && (
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="size-3.5 text-amber-500" />
                        <span className="text-xs text-amber-500 font-medium">Vender</span>
                      </div>
                    )}
                    {row.suggestedAction === "HOLD" && (
                      <div className="flex items-center gap-1.5">
                        <Minus className="size-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Mantener</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {targets.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/40">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70">
              Objetivos configurados
            </p>
          </div>
          <div className="divide-y divide-border">
            {targets.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-mono font-medium text-foreground">{t.ticker}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    {t.targetPct.toFixed(1)}%
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0"
                    disabled={isPending}
                    onClick={() => handleDelete(t.id, t.ticker)}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Agregar objetivo de asignación</DialogTitle>
          </DialogHeader>
          <Separator className="opacity-30" />
          <form onSubmit={handleAdd} className="flex flex-col gap-4 pt-1">
            <Field>
              <FieldLabel className="text-xs font-medium">Ticker</FieldLabel>
              <Input
                placeholder="AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                required
                className="text-sm font-mono uppercase"
              />
            </Field>
            <Field>
              <FieldLabel className="text-xs font-medium">Porcentaje objetivo (%)</FieldLabel>
              <Input
                type="number"
                placeholder="10.5"
                min="0"
                max="100"
                step="0.1"
                value={targetPct}
                onChange={(e) => setTargetPct(e.target.value)}
                required
                className="text-sm font-mono"
              />
            </Field>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(false)} className="text-xs">
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="gap-2">
                {isPending && <Spinner className="size-3" />}
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
