"use client";

import { useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
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
import { formatDateUTC, formatDateNumeric, formatCurrency, formatARS, formatPct } from "@/lib/format";

interface TransactionsClientProps {
  transactions: TransactionRow[];
  ppmData: PpmRow[];
  realizedPnl: RealizedPnlRow[];
  dividends: DividendRow[];
  // Los en pesos, al CCL de su fecha (getTotalDividendsUsd).
  totalDividendsUsd: number;
  movements: MovementRow[];
}

const TABS = ["transactions", "ppm", "pnl", "dividends", "movements"] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string | null): v is Tab => TABS.includes(v as Tab);

const HEAD = "text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9";
// Columnas que en celular no entran: su dato va debajo de la primera columna.
const WIDE = "hidden sm:table-cell";

// "Venta" en secondary casi no se distinguía del fondo de la tabla.
function TradeBadge({ type }: { type: string }) {
  const buy = type === "BUY";
  return (
    <Badge variant={buy ? "default" : "outline"} className="text-[10px] gap-1">
      {buy ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {buy ? "Compra" : "Venta"}
    </Badge>
  );
}

// La fecha larga ("20 de jul de 2026") hacía desbordar las tablas en celular.
function DateText({ date }: { date: Date | string }) {
  return (
    <>
      <span className="sm:hidden">{formatDateNumeric(date)}</span>
      <span className="hidden sm:inline">{formatDateUTC(date)}</span>
    </>
  );
}

function sumByCurrency(rows: RealizedPnlRow[]): [string, number][] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.pnl);
  return [...totals];
}

function signedCurrency(value: number, currency: string): string {
  return `${value >= 0 ? "+" : ""}${formatCurrency(value, currency)}`;
}

export function TransactionsClient({
  transactions,
  ppmData,
  realizedPnl,
  dividends,
  totalDividendsUsd,
  movements,
}: TransactionsClientProps) {
  // La pestaña vive en ?tab= para poder recargar, volver o compartir el link sin
  // caer siempre en la primera. replaceState (sin pushState): cambiar de pestaña
  // no debería llenar el historial del botón "atrás".
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: Tab = isTab(requested) ? requested : "transactions";
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "transactions") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [movementView, setMovementView] = useState<"all" | "fci">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteDivTarget, setDeleteDivTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const realizedByCurrency = sumByCurrency(realizedPnl);

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
      {/* En celular las pestañas no entran: la barra se desliza de costado. La línea
          de abajo es una sombra interna porque overflow-x recorta el -mb-px. */}
      {/* Pestañas con semántica ARIA y flechas del teclado; la línea activa se
          desliza entre pestañas (Motion layoutId, transform) y respeta reduced-motion. */}
      <MotionConfig reducedMotion="user">
        <div
          role="tablist"
          aria-label="Secciones de transacciones"
          className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] shadow-[inset_0_-1px_0_var(--color-border)]"
        >
          {tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!delta) return;
                e.preventDefault();
                const next = (i + delta + tabs.length) % tabs.length;
                setTab(tabs[next].id);
                tabRefs.current[next]?.focus();
              }}
              className={`relative shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-t-md ${
                tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="text-[10px] bg-muted rounded px-1 py-0.5 font-mono">
                  {t.count}
                </span>
              )}
              {tab === t.id && (
                <motion.span
                  layoutId="transactions-tab-indicator"
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground"
                  transition={{ duration: 0.25, ease: [0.77, 0, 0.175, 1] }}
                />
              )}
            </button>
          ))}
        </div>
      </MotionConfig>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="contents">

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
                  <TableHead className="pl-4 sm:pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                    Fecha
                  </TableHead>
                  <TableHead className={`${HEAD} ${WIDE}`}>Tipo</TableHead>
                  <TableHead className={HEAD}>Ticker</TableHead>
                  <TableHead className={`${HEAD} ${WIDE} text-right`}>Cantidad</TableHead>
                  <TableHead className={`${HEAD} ${WIDE} text-right`}>Precio</TableHead>
                  <TableHead className={`${HEAD} text-right`}>Total</TableHead>
                  <TableHead className="pr-4 sm:pr-5 text-[11px] h-9">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-border hover:bg-muted/30">
                    <TableCell className="pl-4 sm:pl-5 py-3 text-xs text-muted-foreground">
                      <DateText date={tx.date} />
                    </TableCell>
                    <TableCell className={`py-3 ${WIDE}`}>
                      <TradeBadge type={tx.type} />
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm font-mono font-medium text-foreground">
                        {tx.ticker}
                      </span>
                      {/* En celular las columnas de tipo, cantidad y precio no entran:
                          van debajo del ticker. */}
                      <span className="mt-0.5 block whitespace-normal text-[11px] text-muted-foreground sm:hidden">
                        <span className="block">{tx.type === "BUY" ? "Compra" : "Venta"}</span>
                        <span className="block whitespace-nowrap">
                          {tx.quantity.toLocaleString("es-AR")} × {formatCurrency(tx.price, tx.currency)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className={`py-3 text-right ${WIDE}`}>
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {tx.quantity.toLocaleString("es-AR")}
                      </span>
                    </TableCell>
                    <TableCell className={`py-3 text-right ${WIDE}`}>
                      <span className="text-sm font-mono tabular-nums text-muted-foreground">
                        {formatCurrency(tx.price, tx.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {formatCurrency(tx.amount, tx.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 sm:pr-5 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0"
                        aria-label={`Eliminar la ${tx.type === "BUY" ? "compra" : "venta"} de ${tx.ticker} del ${formatDateUTC(tx.date)}`}
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
                  <TableHead className="pl-4 sm:pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                    Ticker
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                    Precio promedio
                  </TableHead>
                  <TableHead className={`${HEAD} ${WIDE} text-right`}>Cantidad total</TableHead>
                  <TableHead className="pr-4 sm:pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                    Costo total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ppmData.map((row) => (
                  <TableRow key={row.ticker} className="border-border hover:bg-muted/30">
                    <TableCell className="pl-4 sm:pl-5 py-3.5">
                      <span className="text-sm font-mono font-medium text-foreground">
                        {row.ticker}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {formatARS(row.avgPrice)}
                      </span>
                    </TableCell>
                    <TableCell className={`py-3.5 text-right ${WIDE}`}>
                      <span className="text-sm font-mono tabular-nums text-muted-foreground">
                        {row.totalQuantity.toLocaleString("es-AR")}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 sm:pr-5 py-3.5 text-right">
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {formatARS(row.totalCost)}
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
              <div className="col-span-2 rounded-xl border border-border bg-card shadow-sm px-5 py-4 sm:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">P&L total realizado</p>
                {realizedByCurrency.map(([currency, total]) => (
                  <p
                    key={currency}
                    className={`text-lg font-bold font-mono tabular-nums ${
                      total >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {signedCurrency(total, currency)}
                  </p>
                ))}
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
                  {formatPct((realizedPnl.reduce((sum, r) => sum + r.pnlPct, 0) / realizedPnl.length), { decimals: 2 })}
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
                    <TableHead className="pl-4 sm:pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                      Ticker
                    </TableHead>
                    <TableHead className={`${HEAD} ${WIDE} text-right`}>Cantidad</TableHead>
                    <TableHead className={`${HEAD} ${WIDE} text-right`}>PPM</TableHead>
                    <TableHead className={`${HEAD} ${WIDE} text-right`}>Precio venta</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                      P&L
                    </TableHead>
                    <TableHead className="pr-4 sm:pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                      P&L %
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realizedPnl.map((row, i) => (
                    <TableRow key={i} className="border-border hover:bg-muted/30">
                      <TableCell className="pl-4 sm:pl-5 py-3.5">
                        <span className="text-sm font-mono font-medium text-foreground">
                          {row.ticker}
                        </span>
                        <span className="mt-0.5 block whitespace-normal text-[11px] text-muted-foreground sm:hidden">
                          {row.quantity.toLocaleString("es-AR")} × {formatCurrency(row.sellPrice, row.currency)}
                        </span>
                      </TableCell>
                      <TableCell className={`py-3.5 text-right ${WIDE}`}>
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">
                          {row.quantity.toLocaleString("es-AR")}
                        </span>
                      </TableCell>
                      <TableCell className={`py-3.5 text-right ${WIDE}`}>
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">
                          {formatCurrency(row.buyPrice, row.currency)}
                        </span>
                      </TableCell>
                      <TableCell className={`py-3.5 text-right ${WIDE}`}>
                        <span className="text-sm font-mono tabular-nums text-foreground">
                          {formatCurrency(row.sellPrice, row.currency)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <span
                          className={`text-sm font-mono tabular-nums ${
                            row.pnl >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {signedCurrency(row.pnl, row.currency)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 sm:pr-5 py-3.5 text-right">
                        <span
                          className={`text-sm font-mono tabular-nums ${
                            row.pnlPct >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {formatPct(row.pnlPct, { signed: true, decimals: 2 })}
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
                <p className="text-xs text-muted-foreground mb-1">Total dividendos USD (los en pesos, al CCL de su fecha)</p>
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
                    <TableHead className="pl-4 sm:pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
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
                    <TableHead className="pr-4 sm:pr-5 text-[11px] h-9" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dividends.map((div) => (
                    <TableRow key={`${div.manual ? "m" : "c"}-${div.id}`} className="border-border hover:bg-muted/30">
                      <TableCell className="pl-4 sm:pl-5 py-3 text-xs text-muted-foreground">
                        <DateText date={div.date} />
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="block max-w-[7.5rem] truncate text-sm font-mono font-medium text-foreground sm:max-w-none" title={div.ticker}>
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
                      <TableCell className="pr-4 sm:pr-5 py-3">
                        {div.manual && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7 p-0"
                            aria-label={`Eliminar el dividendo de ${div.ticker} del ${formatDateUTC(div.date)}`}
                            onClick={() => setDeleteDivTarget(div.id)}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}
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
                      <TableHead className="pl-4 sm:pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                        Fecha
                      </TableHead>
                      <TableHead className={`${HEAD} ${WIDE}`}>Categoría</TableHead>
                      <TableHead className={HEAD}>Instrumento</TableHead>
                      <TableHead className={`${HEAD} ${WIDE} text-right`}>Cantidad</TableHead>
                      <TableHead className={`${HEAD} ${WIDE} text-right`}>Precio</TableHead>
                      <TableHead className="pr-4 sm:pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id} className="border-border hover:bg-muted/30">
                        <TableCell className="pl-4 sm:pl-5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          <DateText date={m.date} />
                        </TableCell>
                        <TableCell className={`py-2.5 ${WIDE}`}>
                          <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                            {CATEGORY_LABELS[m.category as MovementCategory] ?? m.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 max-w-[104px] sm:max-w-[260px]">
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
                          <span className="mt-0.5 block whitespace-normal text-[11px] text-muted-foreground sm:hidden">
                            {CATEGORY_LABELS[m.category as MovementCategory] ?? m.category}
                          </span>
                        </TableCell>
                        <TableCell className={`py-2.5 text-right ${WIDE}`}>
                          <span className="text-sm font-mono tabular-nums text-muted-foreground">
                            {m.quantity !== null ? m.quantity.toLocaleString("es-AR") : "—"}
                          </span>
                        </TableCell>
                        <TableCell className={`py-2.5 text-right ${WIDE}`}>
                          <span className="text-sm font-mono tabular-nums text-muted-foreground">
                            {m.price !== null ? formatCurrency(m.price, m.currency) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 sm:pr-5 py-2.5 text-right">
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
                        <TableHead className="pl-4 sm:pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                          Fecha
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                          Operación
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                          Cuotapartes
                        </TableHead>
                        <TableHead className={`${HEAD} ${WIDE} text-right`}>Valor cuotaparte</TableHead>
                        <TableHead className="pr-4 sm:pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fciMovements.map((m) => (
                        <TableRow key={m.id} className="border-border hover:bg-muted/30">
                          <TableCell className="pl-4 sm:pl-5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            <DateText date={m.date} />
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
                          <TableCell className={`py-2.5 text-right ${WIDE}`}>
                            <span className="text-sm font-mono tabular-nums text-muted-foreground">
                              {m.price !== null ? formatCurrency(m.price, m.currency) : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="pr-4 sm:pr-5 py-2.5 text-right">
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

      </div>

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
