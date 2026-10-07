"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, ArrowUpRight, ArrowDownRight, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { importMovements } from "@/app/actions/import-movements";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  parseMovementCsv,
  type MovementCategory,
  type ParsedMovement,
} from "@/lib/cocos-movements";
import { formatDateUTC, formatCurrency } from "@/lib/format";

// Cocos exporta los movimientos como movements_report_YYYY-MM-DD_YYYY-MM-DD.csv.
// El nombre no es obligatorio: si no matchea, se importa igual sin rango de fecha.
const FILENAME_PATTERN = /^movements_report_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.csv$/i;

type DateRange = { from: string; to: string };

function parseFilenameRange(name: string): DateRange | null {
  const match = name.match(FILENAME_PATTERN);
  if (!match) return null;
  const [, from, to] = match;
  return { from, to };
}

type ParsedState = {
  movements: ParsedMovement[];
  counts: Record<MovementCategory, number>;
  warnings: string[];
};

// compact: para headers con varias acciones. Solo el ícono por debajo de 2xl, sin
// el link a la guía (la página ya lo tiene) y con el aviso de error flotando para
// no agrandar el header.
export function ImportMovimientosButton({ compact = false }: { compact?: boolean } = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [isParsing, startParsing] = useTransition();
  const [isImporting, startImporting] = useTransition();
  // Los errores quedan visibles hasta el próximo intento: un toast que se
  // cierra solo se lleva el único detalle del fallo.
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setParsed(null);
    setSelected(new Set());
    setFileName("");
    setDateRange(null);
    setImportError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setFileName(file.name);
    setDateRange(parseFilenameRange(file.name));
    setParseError(null);

    startParsing(async () => {
      const text = await file.text();
      const result = parseMovementCsv(text);
      if (!result.success) {
        setParseError(`${file.name}: ${result.error}`);
        return;
      }
      if (result.movements.length === 0) {
        setParseError(
          `${file.name} no tiene movimientos. Verificá que sea el CSV de Actividad (no el de Portfolio).`
        );
        return;
      }
      setParsed({ movements: result.movements, counts: result.counts, warnings: result.warnings });
      setSelected(new Set(result.movements.map((m) => m.nroTicket)));
      setOpen(true);
    });
  }

  function toggleTicket(ticket: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticket)) next.delete(ticket);
      else next.add(ticket);
      return next;
    });
  }

  function toggleCategory(category: MovementCategory) {
    if (!parsed) return;
    const tickets = parsed.movements.filter((m) => m.category === category).map((m) => m.nroTicket);
    const allSelected = tickets.every((t) => selected.has(t));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of tickets) {
        if (allSelected) next.delete(t);
        else next.add(t);
      }
      return next;
    });
  }

  function toggleAll() {
    if (!parsed) return;
    const allSelected = parsed.movements.every((m) => selected.has(m.nroTicket));
    setSelected(allSelected ? new Set() : new Set(parsed.movements.map((m) => m.nroTicket)));
  }

  function handleImport() {
    if (!parsed) return;
    const rows = parsed.movements.filter((m) => selected.has(m.nroTicket));
    if (rows.length === 0) return;

    setImportError(null);
    startImporting(async () => {
      const result = await importMovements(rows, fileName);
      if (!result.success) {
        setImportError(`No se guardaron los movimientos: ${result.error} La selección se mantiene para que reintentes.`);
        return;
      }

      const msgs: string[] = [];
      if (result.imported > 0) msgs.push(`${result.imported} movimientos importados`);
      if (result.transactionsCreated > 0) msgs.push(`${result.transactionsCreated} transacciones`);
      if (result.duplicates > 0) msgs.push(`${result.duplicates} duplicados omitidos`);
      toast.success(msgs.join(" · ") || "Sin cambios");

      if (result.historyBackfillNeeded) {
        toast.warning("Datos históricos desactualizados", {
          description:
            "Hay compras más antiguas que tus precios/CCL en caché. Actualizá en Ganancia Real para incluirlas.",
          action: { label: "Ir", onClick: () => router.push("/real-gains") },
        });
      }

      reset();
    });
  }

  const grouped = parsed
    ? ALL_CATEGORIES.map((category) => ({
        category,
        rows: parsed.movements.filter((m) => m.category === category),
      })).filter((g) => g.rows.length > 0)
    : [];

  const selectedRows = parsed ? parsed.movements.filter((m) => selected.has(m.nroTicket)) : [];
  const selectedTrades = selectedRows.filter(
    (m) => m.category === "TRADE_BUY" || m.category === "TRADE_SELL"
  ).length;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className={cn("flex flex-col items-end gap-1", compact && "relative")}>
        <Button
          id="tour-import-movimientos"
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={isParsing}
          onClick={() => fileInputRef.current?.click()}
          aria-label={compact ? "Importar CSV Cocos" : undefined}
          title={compact ? "Importar CSV Cocos" : undefined}
        >
          {isParsing ? <Spinner className="size-3" /> : <Upload className="size-3" />}
          <span className={compact ? "hidden 2xl:inline" : undefined}>Importar CSV Cocos</span>
        </Button>
        {!compact && (
          <Link
            href="/guia#transacciones"
            className="text-[11px] text-primary underline-offset-4 hover:underline"
          >
            ¿Cómo descargo movimientos desde Cocos?
          </Link>
        )}
        {parseError && (
          <div
            role="alert"
            className={cn(
              "mt-1 max-w-xs flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-left",
              compact && "absolute right-0 top-full z-20 w-72 bg-popover shadow-lg"
            )}
          >
            <AlertTriangle className="size-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
              {parseError}
            </p>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setParseError(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="text-sm font-medium">
                  Previsualización — {fileName}
                </DialogTitle>
                {dateRange && (
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {formatDateUTC(dateRange.from)} → {formatDateUTC(dateRange.to)}
                  </p>
                )}
                {parsed && (
                  <p className="text-xs text-muted-foreground">
                    {parsed.movements.length} movimientos · {selectedRows.length} seleccionados
                  </p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="size-7 p-0 shrink-0" onClick={reset}>
                <X className="size-3.5" />
              </Button>
            </div>
          </DialogHeader>

          <Separator className="opacity-30" />

          {parsed && parsed.warnings.length > 0 && (
            <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
              <AlertTriangle className="size-3.5 shrink-0 text-warning mt-0.5" />
              <div className="flex flex-col gap-0.5 text-[11px] text-warning">
                {parsed.warnings.slice(0, 5).map((w) => (
                  <span key={w}>{w}</span>
                ))}
                {parsed.warnings.length > 5 && <span>+{parsed.warnings.length - 5} más…</span>}
              </div>
            </div>
          )}

          <div className="overflow-y-auto flex-1 flex flex-col gap-4 pr-1">
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                checked={
                  parsed
                    ? selectedRows.length === parsed.movements.length
                      ? true
                      : selectedRows.length > 0
                        ? "indeterminate"
                        : false
                    : false
                }
                onCheckedChange={toggleAll}
              />
              <span className="text-xs font-medium">Seleccionar todo</span>
            </div>

            {grouped.map(({ category, rows }) => {
              const allSelected = rows.every((r) => selected.has(r.nroTicket));
              const someSelected = rows.some((r) => selected.has(r.nroTicket));
              return (
                <div key={category} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {rows.length}
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent bg-muted/40">
                          <TableHead className="w-8 pl-3 h-8" />
                          <TableHead className="text-[11px] uppercase text-muted-foreground/70 h-8">
                            Fecha
                          </TableHead>
                          <TableHead className="text-[11px] uppercase text-muted-foreground/70 h-8">
                            Tipo
                          </TableHead>
                          <TableHead className="text-[11px] uppercase text-muted-foreground/70 h-8">
                            Instrumento
                          </TableHead>
                          <TableHead className="text-[11px] uppercase text-muted-foreground/70 text-right h-8">
                            Cantidad
                          </TableHead>
                          <TableHead className="text-[11px] uppercase text-muted-foreground/70 text-right h-8">
                            Precio
                          </TableHead>
                          <TableHead className="pr-3 text-[11px] uppercase text-muted-foreground/70 text-right h-8">
                            Total
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const isBuy = row.category === "TRADE_BUY";
                          const isSell = row.category === "TRADE_SELL";
                          return (
                            <TableRow key={row.nroTicket} className="border-border hover:bg-muted/30">
                              <TableCell className="pl-3 py-2">
                                <Checkbox
                                  checked={selected.has(row.nroTicket)}
                                  onCheckedChange={() => toggleTicket(row.nroTicket)}
                                />
                              </TableCell>
                              <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                                {formatDateUTC(row.date)}
                              </TableCell>
                              <TableCell className="py-2">
                                {(isBuy || isSell) && (
                                  <Badge
                                    variant={isBuy ? "default" : "secondary"}
                                    className="text-[10px] gap-1"
                                  >
                                    {isBuy ? (
                                      <ArrowUpRight className="size-3" />
                                    ) : (
                                      <ArrowDownRight className="size-3" />
                                    )}
                                    {isBuy ? "Compra" : "Venta"}
                                  </Badge>
                                )}
                                {!isBuy && !isSell && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {row.rawType}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 max-w-[220px]">
                                {row.ticker ? (
                                  <span
                                    className="text-sm font-mono font-medium text-foreground"
                                    title={row.instrument ?? undefined}
                                  >
                                    {row.ticker}
                                  </span>
                                ) : (
                                  <span
                                    className="text-[11px] text-muted-foreground line-clamp-1"
                                    title={row.instrument ?? undefined}
                                  >
                                    {row.instrument ?? "—"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 text-right">
                                <span className="text-sm font-mono tabular-nums">
                                  {row.quantity !== null ? row.quantity.toLocaleString("es-AR") : "—"}
                                </span>
                              </TableCell>
                              <TableCell className="py-2 text-right">
                                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                                  {row.price !== null ? formatCurrency(row.price, row.currency) : "—"}
                                </span>
                              </TableCell>
                              <TableCell className="pr-3 py-2 text-right">
                                <span
                                  className={`text-sm font-mono tabular-nums ${
                                    row.total >= 0 ? "text-success" : "text-foreground"
                                  }`}
                                >
                                  {formatCurrency(Math.abs(row.total), row.currency)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </div>

          {importError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
            >
              <AlertTriangle className="size-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{importError}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-muted-foreground">
              {selectedTrades} de los seleccionados generarán transacciones (compras/ventas).
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="text-xs" onClick={reset} disabled={isImporting}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isImporting || selectedRows.length === 0}
                onClick={handleImport}
                className="gap-2"
              >
                {isImporting && <Spinner className="size-3" />}
                Importar {selectedRows.length} movimientos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
