"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TransactionRow, PpmRow, RealizedPnlRow } from "@/app/actions/transactions";
import type { DividendRow } from "@/app/actions/dividends";
import { deleteTransaction } from "@/app/actions/transactions";
import { deleteDividend } from "@/app/actions/dividends";

interface TransactionsClientProps {
  transactions: TransactionRow[];
  ppmData: PpmRow[];
  realizedPnl: RealizedPnlRow[];
  dividends: DividendRow[];
}

type Tab = "transactions" | "ppm" | "pnl" | "dividends";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function TransactionsClient({
  transactions,
  ppmData,
  realizedPnl,
  dividends,
}: TransactionsClientProps) {
  const [tab, setTab] = useState<Tab>("transactions");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteDivTarget, setDeleteDivTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalRealizedPnl = realizedPnl.reduce((sum, r) => sum + r.pnl, 0);
  const totalDividendsUsd = dividends
    .filter((d) => d.currency === "USD")
    .reduce((sum, d) => sum + d.amount, 0);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "transactions", label: "Transacciones", count: transactions.length },
    { id: "ppm", label: "Precio Promedio", count: ppmData.length },
    { id: "pnl", label: "P&L Realizado", count: realizedPnl.length },
    { id: "dividends", label: "Dividendos", count: dividends.length },
  ];

  return (
    <>
      <div className="flex items-center gap-0.5 sm:gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-medium transition-colors border-b-2 -mb-px flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
            {t.count > 0 && (
              <span className="text-[9px] sm:text-[10px] bg-muted rounded px-1 py-0.5 font-mono">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "transactions" && (
        transactions.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No hay transacciones registradas
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent bg-muted/40">
                    <TableHead className="pl-3 sm:pl-5 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9 whitespace-nowrap">
                      Fecha
                    </TableHead>
                    <TableHead className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9 whitespace-nowrap">
                      Tipo
                    </TableHead>
                    <TableHead className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9 whitespace-nowrap">
                      Ticker
                    </TableHead>
                    <TableHead className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9 whitespace-nowrap">
                      Cantidad
                    </TableHead>
                    <TableHead className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9 whitespace-nowrap">
                      Precio
                    </TableHead>
                    <TableHead className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9 whitespace-nowrap">
                      Total
                    </TableHead>
                    <TableHead className="pr-3 sm:pr-5 text-[11px] h-9" />
                  </TableRow>
                </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-border hover:bg-muted/30">
                    <TableCell className="pl-3 sm:pl-5 py-2 sm:py-3 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="py-2 sm:py-3">
                      <Badge
                        variant={tx.type === "BUY" ? "default" : "secondary"}
                        className="text-[9px] sm:text-[10px] gap-1"
                      >
                        {tx.type === "BUY" ? (
                          <ArrowUpRight className="size-2.5 sm:size-3" />
                        ) : (
                          <ArrowDownRight className="size-2.5 sm:size-3" />
                        )}
                        <span className="hidden sm:inline">{tx.type === "BUY" ? "Compra" : "Venta"}</span>
                        <span className="sm:hidden">{tx.type === "BUY" ? "C" : "V"}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 sm:py-3">
                      <span className="text-xs sm:text-sm font-mono font-medium text-foreground">
                        {tx.ticker}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 sm:py-3 text-right">
                      <span className="text-xs sm:text-sm font-mono tabular-nums text-foreground">
                        {tx.quantity.toLocaleString("es-AR")}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 sm:py-3 text-right">
                      <span className="text-xs sm:text-sm font-mono tabular-nums text-muted-foreground">
                        {formatCurrency(tx.price, tx.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 sm:py-3 text-right">
                      <span className="text-xs sm:text-sm font-mono tabular-nums text-foreground">
                        {formatCurrency(tx.quantity * tx.price, tx.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-3 sm:pr-5 py-2 sm:py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-6 sm:size-7 p-0"
                        onClick={() => setDeleteTarget(tx.id)}
                      >
                        <Trash2 className="size-3 sm:size-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </div>
        )
      )}

      {tab === "ppm" && (
        ppmData.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No hay datos de precio promedio. Registrá compras primero.
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
                    Precio promedio
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                    Cantidad total
                  </TableHead>
                  <TableHead className="pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                    Costo total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ppmData.map((row) => (
                  <TableRow key={row.ticker} className="border-border hover:bg-muted/30">
                    <TableCell className="pl-5 py-3.5">
                      <span className="text-sm font-mono font-medium text-foreground">
                        {row.ticker}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {formatCurrency(row.avgPrice, row.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <span className="text-sm font-mono tabular-nums text-muted-foreground">
                        {row.totalQuantity.toLocaleString("es-AR")}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5 py-3.5 text-right">
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {formatCurrency(row.totalCost, row.currency)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {tab === "pnl" && (
        <>
          {realizedPnl.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">P&L Total Realizado</p>
                <p
                  className={`text-lg font-bold font-mono ${
                    totalRealizedPnl >= 0 ? "text-emerald-500" : "text-destructive"
                  }`}
                >
                  {totalRealizedPnl >= 0 ? "+" : ""}
                  {totalRealizedPnl.toLocaleString("es-AR")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">Operaciones cerradas</p>
                <p className="text-lg font-bold font-mono text-foreground">
                  {realizedPnl.length}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">Rentabilidad promedio</p>
                <p
                  className={`text-lg font-bold font-mono ${
                    realizedPnl.reduce((sum, r) => sum + r.pnlPct, 0) / realizedPnl.length >= 0
                      ? "text-emerald-500"
                      : "text-destructive"
                  }`}
                >
                  {(realizedPnl.reduce((sum, r) => sum + r.pnlPct, 0) / realizedPnl.length).toFixed(2)}%
                </p>
              </div>
            </div>
          )}
          {realizedPnl.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              No hay ventas registradas.
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
                      Cantidad
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                      PPM
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                      Precio venta
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                      P&L
                    </TableHead>
                    <TableHead className="pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                      P&L %
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realizedPnl.map((row, i) => (
                    <TableRow key={i} className="border-border hover:bg-muted/30">
                      <TableCell className="pl-5 py-3.5">
                        <span className="text-sm font-mono font-medium text-foreground">
                          {row.ticker}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">
                          {row.quantity.toLocaleString("es-AR")}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">
                          {row.buyPrice.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <span className="text-sm font-mono tabular-nums text-foreground">
                          {row.sellPrice.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <span
                          className={`text-sm font-mono tabular-nums ${
                            row.pnl >= 0 ? "text-emerald-500" : "text-destructive"
                          }`}
                        >
                          {row.pnl >= 0 ? "+" : ""}
                          {row.pnl.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-5 py-3.5 text-right">
                        <span
                          className={`text-sm font-mono tabular-nums ${
                            row.pnlPct >= 0 ? "text-emerald-500" : "text-destructive"
                          }`}
                        >
                          {row.pnlPct >= 0 ? "+" : ""}
                          {row.pnlPct.toFixed(2)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {tab === "dividends" && (
        <>
          {dividends.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">Total dividendos USD</p>
                <p className="text-lg font-bold font-mono text-emerald-500">
                  +{formatCurrency(totalDividendsUsd, "USD")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">Cobros registrados</p>
                <p className="text-lg font-bold font-mono text-foreground">{dividends.length}</p>
              </div>
            </div>
          )}
          {dividends.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              No hay dividendos registrados.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent bg-muted/40">
                    <TableHead className="pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                      Fecha
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                      Ticker
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                      Monto
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                      Notas
                    </TableHead>
                    <TableHead className="pr-5 text-[11px] h-9" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dividends.map((div) => (
                    <TableRow key={div.id} className="border-border hover:bg-muted/30">
                      <TableCell className="pl-5 py-3 text-xs text-muted-foreground">
                        {formatDate(div.date)}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm font-mono font-medium text-foreground">
                          {div.ticker}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="text-sm font-mono tabular-nums text-emerald-500">
                          +{formatCurrency(div.amount, div.currency)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{div.notes ?? "—"}</span>
                      </TableCell>
                      <TableCell className="pr-5 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-7 p-0"
                          onClick={() => setDeleteDivTarget(div.id)}
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-medium">Eliminar transacción</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                startTransition(async () => {
                  const result = await deleteTransaction(deleteTarget);
                  if (result.success) {
                    toast.success("Transacción eliminada");
                  } else {
                    toast.error(result.error);
                  }
                  setDeleteTarget(null);
                });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteDivTarget}
        onOpenChange={(open) => { if (!open) setDeleteDivTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-medium">Eliminar dividendo</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteDivTarget) return;
                startTransition(async () => {
                  const result = await deleteDividend(deleteDivTarget);
                  if (result.success) {
                    toast.success("Dividendo eliminado");
                  } else {
                    toast.error(result.error);
                  }
                  setDeleteDivTarget(null);
                });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
