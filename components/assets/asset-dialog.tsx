"use client";

import { useTransition, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { createAsset, updateAsset } from "@/app/actions/assets";

export type AssetRow = {
  id: string;
  ticker: string;
  instrumentName: string | null;
  cedearRatio: number;
  description: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  underlyingTicker: string | null;
};

interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: AssetRow | null;
}

export function AssetDialog({ open, onOpenChange, asset }: AssetDialogProps) {
  const isEdit = !!asset;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const data = {
      ticker: fd.get("ticker") as string,
      instrumentName: fd.get("instrumentName") as string,
      cedearRatio: parseFloat(fd.get("cedearRatio") as string),
      description: fd.get("description") as string,
      sector: fd.get("sector") as string,
      industry: fd.get("industry") as string,
      country: fd.get("country") as string,
      underlyingTicker: fd.get("underlyingTicker") as string,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateAsset(asset!.id, data)
        : await createAsset(data);

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            {isEdit ? `Editar ${asset!.ticker}` : "Nuevo activo CEDEAR"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEdit
              ? "Actualizá los datos del activo. El ticker no puede modificarse."
              : "Registrá un nuevo CEDEAR con su ratio de conversión."}
          </DialogDescription>
        </DialogHeader>

        <Separator className="opacity-30" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-1">
          <FieldGroup>
            {!isEdit && (
              <Field>
                <FieldLabel className="text-xs font-medium">Ticker</FieldLabel>
                <Input
                  name="ticker"
                  placeholder="AAPL"
                  required
                  className="text-sm font-mono uppercase"
                  style={{ textTransform: "uppercase" }}
                />
                <FieldDescription className="text-xs text-muted-foreground">
                  Símbolo del CEDEAR (ej: AAPL, NVDA, MELI)
                </FieldDescription>
              </Field>
            )}

            <Field>
              <FieldLabel className="text-xs font-medium">
                Nombre del instrumento{" "}
                <span className="font-normal text-muted-foreground">opcional</span>
              </FieldLabel>
              <Input
                name="instrumentName"
                placeholder="Apple Inc."
                defaultValue={asset?.instrumentName ?? ""}
                className="text-sm"
              />
            </Field>

            <Field>
              <FieldLabel className="text-xs font-medium">Ratio CEDEAR</FieldLabel>
              <Input
                name="cedearRatio"
                type="number"
                step="0.0001"
                min="0.0001"
                required
                placeholder="10"
                defaultValue={asset?.cedearRatio ?? ""}
                className="text-sm font-mono"
              />
              <FieldDescription className="text-xs text-muted-foreground">
                Cantidad de CEDEARs por 1 acción subyacente (ej: AAPL → 10)
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel className="text-xs font-medium">
                Ticker subyacente{" "}
                <span className="font-normal text-muted-foreground">opcional</span>
              </FieldLabel>
              <Input
                name="underlyingTicker"
                placeholder="AAPL"
                defaultValue={asset?.underlyingTicker ?? ""}
                className="text-sm font-mono uppercase"
                style={{ textTransform: "uppercase" }}
              />
              <FieldDescription className="text-xs text-muted-foreground">
                Ticker de la acción subyacente en Yahoo Finance (ej: AAPL para Apple)
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel className="text-xs font-medium">
                  Sector{" "}
                  <span className="font-normal text-muted-foreground">opcional</span>
                </FieldLabel>
                <Input
                  name="sector"
                  placeholder="Technology"
                  defaultValue={asset?.sector ?? ""}
                  className="text-sm"
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">
                  País{" "}
                  <span className="font-normal text-muted-foreground">opcional</span>
                </FieldLabel>
                <Input
                  name="country"
                  placeholder="USA"
                  defaultValue={asset?.country ?? ""}
                  className="text-sm"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel className="text-xs font-medium">
                Industria{" "}
                <span className="font-normal text-muted-foreground">opcional</span>
              </FieldLabel>
              <Input
                name="industry"
                placeholder="Consumer Electronics"
                defaultValue={asset?.industry ?? ""}
                className="text-sm"
              />
            </Field>

            <Field>
              <FieldLabel className="text-xs font-medium">
                Descripción{" "}
                <span className="font-normal text-muted-foreground">opcional</span>
              </FieldLabel>
              <Textarea
                name="description"
                placeholder="Notas sobre este activo..."
                defaultValue={asset?.description ?? ""}
                rows={2}
                className="text-sm resize-none"
              />
            </Field>
          </FieldGroup>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
              <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="gap-2">
              {isPending && <Spinner className="size-3" />}
              {isEdit ? "Guardar cambios" : "Crear activo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
