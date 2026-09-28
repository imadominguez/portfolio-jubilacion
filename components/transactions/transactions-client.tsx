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
import type { MovementRow } from "@/app/actions/import-movements";
import { deleteTransaction } from "@/app/actions/transactions";
import { deleteDividend } from "@/app/actions/dividends";
import { CATEGORY_LABELS, type MovementCategory } from "@/lib/cocos-movements";
import { formatDateUTC, formatCurrency } from "@/lib/format";

interface TransactionsClientProps {
  transactions: TransactionRow[];
  ppmData: PpmRow[];
  realizedPnl: RealizedPnlRow[];
  dividends: DividendRow[];
  movements: MovementRow[];
}

type Tab = "transactions" | "ppm" | "pnl" | "dividends" | "movements";

export function TransactionsClient({
  transactions,
  ppmData,
  realizedPnl,
  dividends,
  movements,
}: TransactionsClientProps) {
  const [tab, setTab] = useState<Tab>("transactions");
  const [movementView, setMovementView] = useState<"all" | "fci">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteDivTarget, setDeleteDivTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalRealizedPnl = realizedPnl.reduce((sum, r) => sum + r.pnl, 0);
  const totalDividendsUsd = dividends
    .filter((d) => d.currency === "USD")
    .reduce((sum, d) => sum + d.amount, 0);

  const fciMovements = movements.filter(
    (m) => m.category === "FCI_SUBSCRIPTION" || m.category === "FCI_REDEMPTION"
  );
  const funds = (() => {
    const map = new Map<
      string,
      {
        instrument: string;
        ticker: string | null;
        subscribedQty: number;
        redeemedQty: number;
        subscribedAmount: number;
        redeemedAmount: number;
      }
    >();
    for (const m of fciMovements) {
      const key = m.ticker ?? m.instrument ?? "FCI";
      const g =
        map.get(key) ??
        {
          instrument: m.instrument ?? key,
          ticker: m.ticker,
          subscribedQty: 0,
          redeemedQty: 0,
          subscribedAmount: 0,
          redeemedAmount: 0,
        };
      const qty = Math.abs(m.quantity ?? 0);
      if (m.category === "FCI_SUBSCRIPTION") {
        g.subscribedQty += qty;
        g.subscribedAmount += Math.abs(m.total);
      } else {
        g.redeemedQty += qty;
        g.redeemedAmount += Math.abs(m.total);
      }
      map.set(key, g);
    }
    return [...map.values()];
  })();

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "transactions", label: "Transacciones", count: transactions.length },
    { id: "ppm", label: "Precio Promedio", count: ppmData.length },
    { id: "pnl", label: "P&L Realizado", count: realizedPnl.length },
    { id: "dividends", label: "Dividendos", count: dividends.length },
    { id: "movements", label: "Movimientos", count: movements.length },
  ];

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="text-[10px] bg-muted rounded px-1 py-0.5 font-mono">
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
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/40">
                  <TableHead className="pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                    Fecha
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                    Tipo
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                    Ticker
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                    Cantidad
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                    Precio
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                    Total
                  </TableHead>
                  <TableHead className="pr-5 text-[11px] h-9" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-border hover:bg-muted/30">
                    <TableCell className="pl-5 py-3 text-xs text-muted-foreground">
                      {formatDateUTC(tx.date)}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant={tx.type === "BUY" ? "default" : "secondary"}
                        className="text-[10px] gap-1"
                      >
                        {tx.type === "BUY" ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {tx.type === "BUY" ? "Compra" : "Venta"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm font-mono font-medium text-foreground">
                        {tx.ticker}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {tx.quantity.toLocaleString("es-AR")}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-mono tabular-nums text-muted-foreground">
                        {formatCurrency(tx.price, tx.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {formatCurrency(tx.quantity * tx.price, tx.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0"
                        onClick={() => setDeleteTarget(tx.id)}
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                    totalRealizedPnl >= 0 ? "text-success" : "text-destructive"
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
                      ? "text-success"
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
                            row.pnl >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {row.pnl >= 0 ? "+" : ""}
                          {row.pnl.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-5 py-3.5 text-right">
                        <span
                          className={`text-sm font-mono tabular-nums ${
                            row.pnlPct >= 0 ? "text-success" : "text-destructive"
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
                <p className="text-lg font-bold font-mono text-success">
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
                        {formatDateUTC(div.date)}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm font-mono font-medium text-foreground">
                          {div.ticker}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="text-sm font-mono tabular-nums text-success">
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

      {tab === "movements" && (
        <>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMovementView("all")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                movementView === "all"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({movements.length})
            </button>
            <button
              onClick={() => setMovementView("fci")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                movementView === "fci"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fondos FCI ({fciMovements.length})
            </button>
          </div>

          {movementView === "all" &&
            (movements.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No hay movimientos importados. Importá el CSV de Cocos para verlos acá.
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
                        Categoría
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                        Instrumento
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                        Cantidad
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                        Precio
                      </TableHead>
                      <TableHead className="pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id} className="border-border hover:bg-muted/30">
                        <TableCell className="pl-5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateUTC(m.date)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                            {CATEGORY_LABELS[m.category as MovementCategory] ?? m.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 max-w-[260px]">
                          {m.ticker ? (
                            <span
                              className="text-sm font-mono font-medium text-foreground"
                              title={m.instrument ?? undefined}
                            >
                              {m.ticker}
                            </span>
                          ) : (
                            <span
                              className="text-[11px] text-muted-foreground line-clamp-1"
                              title={m.instrument ?? undefined}
                            >
                              {m.instrument ?? m.rawType}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="text-sm font-mono tabular-nums text-muted-foreground">
                            {m.quantity !== null ? m.quantity.toLocaleString("es-AR") : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="text-sm font-mono tabular-nums text-muted-foreground">
                            {m.price !== null ? formatCurrency(m.price, m.currency) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="pr-5 py-2.5 text-right">
                          <span
                            className={`text-sm font-mono tabular-nums ${
                              m.total >= 0 ? "text-success" : "text-foreground"
                            }`}
                          >
                            {formatCurrency(m.total, m.currency)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

          {movementView === "fci" &&
            (funds.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No hay movimientos de fondos FCI. Importá el CSV de Cocos para verlos acá.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {funds.map((fund, i) => (
                  <div
                    key={fund.ticker ?? i}
                    className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">
                        {fund.ticker ?? fund.instrument}
                      </span>
                      {fund.instrument && fund.instrument !== fund.ticker && (
                        <span className="text-[11px] text-muted-foreground">
                          {fund.instrument}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">Aportado</p>
                        <p className="text-sm font-mono tabular-nums text-foreground">
                          {formatCurrency(fund.subscribedAmount, "ARS")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">Rescatado</p>
                        <p className="text-sm font-mono tabular-nums text-foreground">
                          {formatCurrency(fund.redeemedAmount, "ARS")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">Cuotapartes netas</p>
                        <p className="text-sm font-mono tabular-nums text-foreground">
                          {(fund.subscribedQty - fund.redeemedQty).toLocaleString("es-AR", {
                            maximumFractionDigits: 4,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent bg-muted/40">
                        <TableHead className="pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                          Fecha
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                          Operación
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                          Cuotapartes
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                          Valor cuotaparte
                        </TableHead>
                        <TableHead className="pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fciMovements.map((m) => (
                        <TableRow key={m.id} className="border-border hover:bg-muted/30">
                          <TableCell className="pl-5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateUTC(m.date)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge
                              variant={m.category === "FCI_SUBSCRIPTION" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {m.category === "FCI_SUBSCRIPTION" ? "Suscripción" : "Rescate"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-sm font-mono tabular-nums text-muted-foreground">
                              {m.quantity !== null
                                ? m.quantity.toLocaleString("es-AR", { maximumFractionDigits: 4 })
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-sm font-mono tabular-nums text-muted-foreground">
                              {m.price !== null ? formatCurrency(m.price, m.currency) : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="pr-5 py-2.5 text-right">
                            <span
                              className={`text-sm font-mono tabular-nums ${
                                m.total >= 0 ? "text-success" : "text-foreground"
                              }`}
                            >
                              {formatCurrency(m.total, m.currency)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
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
