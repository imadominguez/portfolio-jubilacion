"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, CheckCircle, AlertCircle, ArrowLeft, FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Field, FieldLabel, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseSnapshotPreview, importSnapshot, type ParsedPosition } from "@/app/actions/snapshots";
import { getExchangeRateForDate } from "@/app/actions/exchange-rate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "select" | "preview" | "done";

interface PreviewData {
  positions: ParsedPosition[];
  totalValueArs: number;
  hasUsdPositions: boolean;
  missingCcl: boolean;
}

// Cocos Capital exporta el snapshot con el formato: portfolio_report_YYYYMMDD.csv
const FILENAME_PATTERN = /^portfolio_report_(\d{4})(\d{2})(\d{2})\.csv$/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type FilenameParseResult =
  | { success: true; date: string }
  | { success: false; error: string };

function parseFilename(name: string): FilenameParseResult {
  const match = name.match(FILENAME_PATTERN);
  if (!match) {
    return {
      success: false,
      error:
        "El archivo debe llamarse portfolio_report_AAAAMMDD.csv (ej: portfolio_report_20260504.csv).",
    };
  }
  const [, year, month, day] = match;
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return {
      success: false,
      error: `La fecha "${day}/${month}/${year}" extraída del nombre del archivo no es válida.`,
    };
  }
  return { success: true, date };
}

// ---------------------------------------------------------------------------
// ImportCsvSheet
// ---------------------------------------------------------------------------

interface ImportCsvSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Saved form values needed to confirm after preview
type SavedFormValues = {
  file: File;
  date: string;
  ccl: string;
};

export function ImportCsvSheet({ open, onOpenChange }: ImportCsvSheetProps) {
  const [step, setStep] = useState<Step>("select");
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [savedValues, setSavedValues] = useState<SavedFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  // Estado controlado del formulario para poder auto-rellenarlo desde el archivo.
  const [date, setDate] = useState<string>("");
  const [ccl, setCcl] = useState<string>("");
  const [cclAutofilled, setCclAutofilled] = useState<boolean>(false);
  const [cclMissingForDate, setCclMissingForDate] = useState<boolean>(false);

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function reset() {
    setStep("select");
    setPreview(null);
    setSavedValues(null);
    setError(null);
    setFileName(null);
    setImportedCount(null);
    setDate("");
    setCcl("");
    setCclAutofilled(false);
    setCclMissingForDate(false);
    setSelectedFile(null);
    formRef.current?.reset();
  }

  function handleClose() {
    if (isPending) return;
    onOpenChange(false);
    setTimeout(reset, 300);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    setCclAutofilled(false);
    setCclMissingForDate(false);

    if (!file) {
      setFileName(null);
      setSelectedFile(null);
      setDate("");
      setCcl("");
      return;
    }

    setFileName(file.name);

    const parsed = parseFilename(file.name);
    if (!parsed.success) {
      setSelectedFile(null);
      setDate("");
      setCcl("");
      setError(parsed.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setDate(parsed.date);

    startTransition(async () => {
      const rate = await getExchangeRateForDate(parsed.date);
      if (rate) {
        setCcl(String(rate.ccl));
        setCclAutofilled(true);
        setCclMissingForDate(false);
      } else {
        setCcl("");
        setCclAutofilled(false);
        setCclMissingForDate(true);
      }
    });
  }

  function handlePreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Adjuntá un archivo válido antes de continuar.");
      return;
    }
    if (!date) {
      setError("No se pudo determinar la fecha del snapshot.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("date", date);
    if (ccl) formData.append("ccl", ccl);

    setSavedValues({ file: selectedFile, date, ccl });

    startTransition(async () => {
      const result = await parseSnapshotPreview(formData);
      if (result.success) {
        setPreview({
          positions: result.positions,
          totalValueArs: result.totalValueArs,
          hasUsdPositions: result.hasUsdPositions,
          missingCcl: result.missingCcl,
        });
        setStep("preview");
      } else {
        setError(result.error);
      }
    });
  }

  function handleConfirm() {
    if (!savedValues) return;
    setError(null);

    const formData = new FormData();
    formData.append("file", savedValues.file);
    formData.append("date", savedValues.date);
    if (savedValues.ccl) formData.append("ccl", savedValues.ccl);

    startTransition(async () => {
      const result = await importSnapshot(formData);
      if (result.success) {
        setImportedCount(result.positionCount);
        setStep("done");
      } else {
        setError(result.error);
      }
    });
  }

  const stepLabel = step === "select" ? "1 / 2 — Seleccionar" : step === "preview" ? "2 / 2 — Revisar" : "Completado";

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b border-border/40">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-medium">Importar snapshot CSV</SheetTitle>
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              {stepLabel}
            </span>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            {step === "select" && "Seleccioná el CSV exportado desde Cocos Capital e ingresá la fecha correspondiente."}
            {step === "preview" && "Revisá las posiciones detectadas antes de confirmar el registro."}
            {step === "done" && "El snapshot fue registrado correctamente en el historial."}
          </SheetDescription>
        </SheetHeader>

        {/* ---------------------------------------------------------------- */}
        {/* Step 1: Select file                                               */}
        {/* ---------------------------------------------------------------- */}
        {step === "select" && (
          <form
            ref={formRef}
            onSubmit={handlePreview}
            className="flex flex-col gap-6 px-6 py-6 flex-1"
          >
            <FieldGroup>
              <Field>
                <FieldLabel className="text-xs font-medium">Archivo CSV</FieldLabel>
                <Input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  accept=".csv"
                  required
                  onChange={handleFileChange}
                  className="cursor-pointer text-xs file:text-xs file:font-medium file:mr-3 file:text-muted-foreground"
                />
                <FieldDescription className="text-xs text-muted-foreground">
                  Formato esperado:{" "}
                  <span className="font-mono text-foreground">portfolio_report_AAAAMMDD.csv</span>
                </FieldDescription>
                {fileName && (
                  <FieldDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="size-3 shrink-0" />
                    {fileName}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel className="text-xs font-medium">Fecha del snapshot</FieldLabel>
                <Input
                  type="date"
                  name="date"
                  required
                  value={date}
                  readOnly
                  disabled={!date}
                  className="text-sm font-mono"
                />
                <FieldDescription className="text-xs text-muted-foreground">
                  Se detecta automáticamente desde el nombre del archivo.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel className="text-xs font-medium flex items-center gap-2">
                  CCL{" "}
                  <span className="font-normal text-muted-foreground">(ARS/USD)</span>
                  {cclAutofilled && (
                    <Badge variant="secondary" className="font-mono text-[10px] gap-1">
                      <CheckCircle className="size-2.5" />
                      Auto
                    </Badge>
                  )}
                </FieldLabel>
                <Input
                  type="number"
                  name="ccl"
                  placeholder="1200.00"
                  step="0.01"
                  min="0"
                  value={ccl}
                  onChange={(e) => {
                    setCcl(e.target.value);
                    setCclAutofilled(false);
                  }}
                  disabled={!date}
                  className="text-sm font-mono"
                />
                <FieldDescription className="text-xs text-muted-foreground">
                  {cclAutofilled
                    ? "Valor obtenido automáticamente desde la cotización guardada."
                    : cclMissingForDate
                      ? "No hay un CCL guardado para esta fecha. Ingresalo manualmente si tu portfolio tiene posiciones en USD."
                      : "Tipo de cambio del día. Obligatorio si el archivo tiene posiciones en USD."}
                </FieldDescription>
              </Field>
            </FieldGroup>

            {error && <ErrorAlert message={error} />}

            <div className="mt-auto flex flex-col gap-2">
              <Button
                type="submit"
                disabled={isPending || !selectedFile || !date}
                className="w-full gap-2"
              >
                {isPending
                  ? <><Spinner className="size-3.5" /> Analizando...</>
                  : <><Upload className="size-3.5" data-icon="inline-start" /> Previsualizar</>
                }
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={isPending}
                className="w-full text-xs text-muted-foreground"
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step 2: Preview parsed positions                                  */}
        {/* ---------------------------------------------------------------- */}
        {step === "preview" && preview && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Summary bar */}
            <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between gap-4 bg-muted/20">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Total detectado (ARS)
                </span>
                <span className="text-base font-mono font-medium tabular-nums text-foreground">
                  {formatARS(preview.totalValueArs)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {preview.hasUsdPositions && (
                  <Badge variant="outline" className="font-mono text-[10px] gap-1">
                    <Info className="size-2.5" />
                    USD
                  </Badge>
                )}
                <Badge variant="secondary" className="font-mono text-xs">
                  {preview.positions.length} posiciones
                </Badge>
              </div>
            </div>

            {preview.missingCcl && (
              <div className="px-6 pt-4">
                <WarningAlert message="El archivo contiene posiciones en USD pero no se ingresó el CCL. El total ARS no incluye esas posiciones. Volvé al paso anterior y agregá el CCL para una conversión correcta." />
              </div>
            )}

            {/* Position table */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40">
                      {["Ticker", "Mon.", "Cant.", "Precio", "Valor", "Peso"].map((h) => (
                        <th
                          key={h}
                          className="pb-2 text-left font-medium tracking-wider text-muted-foreground uppercase text-[10px] last:text-right"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {preview.positions.map((p) => {
                      const formatValue = p.currency === "USD" ? formatUSD : formatARS;
                      return (
                        <tr key={p.ticker}>
                          <td className="py-2.5 pr-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium font-mono text-foreground">
                                {p.ticker}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                {p.instrumentName}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-2">
                            <Badge
                              variant={p.currency === "USD" ? "default" : "outline"}
                              className="font-mono text-[10px]"
                            >
                              {p.currency}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-2 font-mono tabular-nums text-muted-foreground">
                            {p.quantity % 1 === 0 ? p.quantity.toFixed(0) : p.quantity.toFixed(2)}
                          </td>
                          <td className="py-2.5 pr-2 font-mono tabular-nums text-foreground">
                            {formatValue(p.price)}
                          </td>
                          <td className="py-2.5 pr-2 font-mono tabular-nums font-medium text-foreground">
                            {formatValue(p.positionValue)}
                          </td>
                          <td className="py-2.5 text-right">
                            <Badge variant="secondary" className="font-mono text-[10px] tabular-nums">
                              {(p.allocationPct * 100).toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollArea>

            <Separator className="opacity-30" />

            {error && (
              <div className="px-6 pt-4">
                <ErrorAlert message={error} />
              </div>
            )}

            {/* Actions */}
            <div className="px-6 py-4 flex flex-col gap-2">
              <Button
                onClick={handleConfirm}
                disabled={isPending || preview.missingCcl}
                className="w-full gap-2"
              >
                {isPending
                  ? <><Spinner className="size-3.5" /> Guardando...</>
                  : <><CheckCircle className="size-3.5" data-icon="inline-start" /> Confirmar importación</>
                }
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStep("select"); setError(null); }}
                disabled={isPending}
                className="w-full text-xs text-muted-foreground gap-1.5"
              >
                <ArrowLeft className="size-3" />
                Volver
              </Button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step 3: Done                                                      */}
        {/* ---------------------------------------------------------------- */}
        {step === "done" && (
          <div className="flex flex-col flex-1 items-center justify-center gap-5 px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle className="size-5 text-emerald-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">Snapshot importado</p>
              <p className="text-xs text-muted-foreground">
                {importedCount} posiciones registradas correctamente en el historial del portfolio.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { reset(); }}
                className="w-full gap-2 text-xs"
              >
                <Upload className="size-3" data-icon="inline-start" />
                Importar otro snapshot
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="w-full text-xs text-muted-foreground"
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// ErrorAlert — shared error display
// ---------------------------------------------------------------------------

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
      <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium text-destructive">Error al procesar</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function WarningAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium text-amber-500">CCL faltante</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
