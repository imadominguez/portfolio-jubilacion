"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { createDividend } from "@/app/actions/dividends";
import type { Currency } from "@/app/generated/prisma/client";

export function DividendForm() {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createDividend({
        ticker: fd.get("ticker") as string,
        amount: parseFloat(fd.get("amount") as string),
        currency,
        date: fd.get("date") as string,
        notes: fd.get("notes") as string,
      });

      if (result.success) {
        toast.success("Dividendo registrado");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <DollarSign className="size-3" />
        Registrar dividendo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Registrar dividendo</DialogTitle>
          </DialogHeader>
          <Separator className="opacity-30" />
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
            <Field>
              <FieldLabel className="text-xs font-medium">Ticker</FieldLabel>
              <Input
                name="ticker"
                placeholder="AAPL"
                required
                className="text-sm font-mono uppercase"
                style={{ textTransform: "uppercase" }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel className="text-xs font-medium">Monto total recibido</FieldLabel>
                <Input
                  name="amount"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  placeholder="25.50"
                  required
                  className="text-sm font-mono"
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Moneda</FieldLabel>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel className="text-xs font-medium">Fecha de cobro</FieldLabel>
              <Input
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="text-sm"
              />
            </Field>

            <Field>
              <FieldLabel className="text-xs font-medium">
                Notas{" "}
                <span className="font-normal text-muted-foreground">opcional</span>
              </FieldLabel>
              <Textarea
                name="notes"
                placeholder="Período, porcentaje por acción..."
                rows={2}
                className="text-sm resize-none"
              />
            </Field>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs">
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
