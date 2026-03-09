"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, ArrowUpRight, ArrowDownRight, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  parseCocosMovimientosCsv,
  importMovimientos,
} from "@/app/actions/import-movements";
import type { MovimientoRow, ParsedMovimientos } from "@/app/actions/import-movements";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatNumber(n: number, currency: string) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function ImportMovimientosButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedMovimientos | null>(null);
  const [fileName, setFileName] = useState("");
  const [isParsing, startParsing] = useTransition();
  const [isImporting, startImporting] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    startParsing(async () => {
      const text = await file.text();
      const result = await parseCocosMovimientosCsv(text);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setParsed(result);
      setOpen(true);
    });

    // Reset input so the same file can be selected again
    e.target.value = "";
  }

  function handleImport() {
    if (!parsed || parsed.rows.length === 0) return;

    startImporting(async () => {
      const result = await importMovimientos(parsed.rows);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const msgs: string[] = [];
      if (result.imported > 0) msgs.push(`${result.imported} transacciones importadas`);
      if (result.duplicates > 0) msgs.push(`${result.duplicates} duplicadas omitidas`);
      toast.success(msgs.join(" · ") || "Sin cambios");

      setOpen(false);
      setParsed(null);
      setFileName("");
    });
  }

  function handleClose() {
    if (isImporting) return;
    setOpen(false);
    setParsed(null);
    setFileName("");
  }

  const skipped = parsed?.skippedReasons;
  const skippedDetails: string[] = [];
  if (skipped) {
    if (skipped.fci > 0) skippedDetails.push(`${skipped.fci} FCI`);
    if (skipped.pagos > 0) skippedDetails.push(`${skipped.pagos} pagos/cobros`);
    if (skipped.dividendos > 0) skippedDetails.push(`${skipped.dividendos} dividendos`);
    if (skipped.mep > 0) skippedDetails.push(`${skipped.mep} MEP/conversiones`);
    if (skipped.other > 0) skippedDetails.push(`${skipped.other} otros`);
  }

  const buyCount = parsed?.rows.filter((r) => r.type === "BUY").length ?? 0;
  const sellCount = parsed?.rows.filter((r) => r.type === "SELL").length ?? 0;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs"
        disabled={isParsing}
        onClick={() => fileInputRef.current?.click()}
      >
        {isParsing ? <Spinner className="size-3" /> : <Upload className="size-3" />}
        Importar CSV Cocos
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="text-sm font-medium">
                  Previsualización — {fileName}
                </DialogTitle>
                {parsed && (
                  <p className="text-xs text-muted-foreground">
                    {buyCount > 0 && `${buyCount} compra${buyCount !== 1 ? "s" : ""}`}
                    {buyCount > 0 && sellCount > 0 && " · "}
                    {sellCount > 0 && `${sellCount} venta${sellCount !== 1 ? "s" : ""}`}
                    {parsed.skippedCount > 0 && ` · ${parsed.skippedCount} filas ignoradas`}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="size-7 p-0 shrink-0"
                onClick={handleClose}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </DialogHeader>

          <Separator className="opacity-30" />

          {parsed?.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <AlertTriangle className="size-5 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No se encontraron compras ni ventas para importar.
              </p>
              {parsed.skippedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {parsed.skippedCount} filas ignoradas ({skippedDetails.join(", ")})
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-y-auto flex-1 rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent bg-muted/40">
                      <TableHead className="pl-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-8">
                        Fecha
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-8">
                        Tipo
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-8">
                        Ticker
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-8">
                        Cantidad
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-8">
                        Precio
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-8">
                        Comisión
                      </TableHead>
                      <TableHead className="pr-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-8">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed?.rows.map((row: MovimientoRow) => (
                      <TableRow key={row.nroTicket} className="border-border hover:bg-muted/30">
                        <TableCell className="pl-4 py-2.5 text-xs text-muted-foreground">
                          {formatDate(row.date)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge
                            variant={row.type === "BUY" ? "default" : "secondary"}
                            className="text-[10px] gap-1"
                          >
                            {row.type === "BUY" ? (
                              <ArrowUpRight className="size-3" />
                            ) : (
                              <ArrowDownRight className="size-3" />
                            )}
                            {row.type === "BUY" ? "Compra" : "Venta"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span
                            className="text-sm font-mono font-medium text-foreground"
                            title={row.instrumento}
                          >
                            {row.ticker}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="text-sm font-mono tabular-nums text-foreground">
                            {row.quantity.toLocaleString("es-AR")}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="text-sm font-mono tabular-nums text-muted-foreground">
                            {formatNumber(row.price, row.currency)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="text-xs font-mono tabular-nums text-muted-foreground">
                            {row.fee > 0 ? formatNumber(row.fee, row.currency) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 py-2.5 text-right">
                          <span
                            className={`text-sm font-mono tabular-nums ${
                              row.total >= 0 ? "text-emerald-500" : "text-foreground"
                            }`}
                          >
                            {formatNumber(Math.abs(row.total), row.currency)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Footer summary */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex flex-col gap-0.5">
                  {parsed && parsed.skippedCount > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      <span className="text-amber-500 font-medium">
                        {parsed.skippedCount} filas ignoradas:
                      </span>{" "}
                      {skippedDetails.join(", ")}
                      {(parsed.skippedReasons.dividendos ?? 0) > 0 &&
                        " (dividendos sin ticker — cargalos manualmente)"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleClose}
                    disabled={isImporting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={isImporting || parsed?.rows.length === 0}
                    onClick={handleImport}
                    className="gap-2"
                  >
                    {isImporting && <Spinner className="size-3" />}
                    Importar {parsed?.rows.length} transacciones
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
