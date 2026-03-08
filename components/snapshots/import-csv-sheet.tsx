"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, CheckCircle, AlertCircle, ArrowLeft, FileText } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "select" | "preview" | "done";

interface PreviewData {
  positions: ParsedPosition[];
  totalValueArs: number;
}

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
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    setStep("select");
    setPreview(null);
    setSavedValues(null);
    setError(null);
    setFileName(null);
    setImportedCount(null);
    formRef.current?.reset();
  }

  function handleClose() {
    if (isPending) return;
    onOpenChange(false);
    // Delay reset so sheet closing animation plays first
    setTimeout(reset, 300);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null);
    setError(null);
  }

  // Step 1 → Step 2: parse CSV via Server Action (no DB write), save form values
  function handlePreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    // Save values now — the form will unmount when we go to step 2
    const file = formData.get("file") as File;
    const date = formData.get("date") as string;
    const ccl = formData.get("ccl") as string;
    setSavedValues({ file, date, ccl });

    startTransition(async () => {
      const result = await parseSnapshotPreview(formData);
      if (result.success) {
        setPreview({ positions: result.positions, totalValueArs: result.totalValueArs });
        setStep("preview");
      } else {
        setError(result.error);
      }
    });
  }

  // Step 2 → Step 3: reconstruct FormData from saved values and save to DB
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
                  type="file"
                  name="file"
                  accept=".csv,.txt"
                  required
                  onChange={handleFileChange}
                  className="cursor-pointer text-xs file:text-xs file:font-medium file:mr-3 file:text-muted-foreground"
                />
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
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="text-sm font-mono"
                />
                <FieldDescription className="text-xs text-muted-foreground">
                  Fecha a la que corresponde este estado del portfolio.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel className="text-xs font-medium">
                  CCL{" "}
                  <span className="font-normal text-muted-foreground">
                    (ARS/USD · opcional)
                  </span>
                </FieldLabel>
                <Input
                  type="number"
                  name="ccl"
                  placeholder="1200.00"
                  step="0.01"
                  min="0"
                  className="text-sm font-mono"
                />
                <FieldDescription className="text-xs text-muted-foreground">
                  Tipo de cambio del día para calcular el equivalente en USD.
                </FieldDescription>
              </Field>
            </FieldGroup>

            {error && <ErrorAlert message={error} />}

            <div className="mt-auto flex flex-col gap-2">
              <Button type="submit" disabled={isPending} className="w-full gap-2">
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
                  Total detectado
                </span>
                <span className="text-base font-mono font-medium tabular-nums text-foreground">
                  {formatARS(preview.totalValueArs)}
                </span>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {preview.positions.length} posiciones
              </Badge>
            </div>

            {/* Position table */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40">
                      {["Ticker", "Cant.", "Precio", "Valor", "Peso"].map((h) => (
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
                    {preview.positions.map((p) => (
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
                        <td className="py-2.5 pr-2 font-mono tabular-nums text-muted-foreground">
                          {p.quantity % 1 === 0 ? p.quantity.toFixed(0) : p.quantity.toFixed(2)}
                        </td>
                        <td className="py-2.5 pr-2 font-mono tabular-nums text-foreground">
                          {formatARS(p.price)}
                        </td>
                        <td className="py-2.5 pr-2 font-mono tabular-nums font-medium text-foreground">
                          {formatARS(p.positionValue)}
                        </td>
                        <td className="py-2.5 text-right">
                          <Badge variant="secondary" className="font-mono text-[10px] tabular-nums">
                            {(p.allocationPct * 100).toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
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
                disabled={isPending}
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
