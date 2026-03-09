"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { createTransaction } from "@/app/actions/transactions";
import type { TransactionType, Currency } from "@/app/generated/prisma/client";

export function TransactionForm() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("BUY");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createTransaction({
        ticker: fd.get("ticker") as string,
        type,
        quantity: parseFloat(fd.get("quantity") as string),
        price: parseFloat(fd.get("price") as string),
        currency,
        fee: fd.get("fee") ? parseFloat(fd.get("fee") as string) : undefined,
        date: fd.get("date") as string,
        notes: fd.get("notes") as string,
      });

      if (result.success) {
        toast.success("Transacción registrada");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <Plus className="size-3" />
        Nueva transacción
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Registrar transacción</DialogTitle>
          </DialogHeader>
          <Separator className="opacity-30" />
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel className="text-xs font-medium">Tipo</FieldLabel>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as TransactionType)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">Compra</SelectItem>
                    <SelectItem value="SELL">Venta</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel className="text-xs font-medium">Cantidad</FieldLabel>
                <Input
                  name="quantity"
                  type="number"
                  step="0.00000001"
                  min="0.00000001"
                  placeholder="100"
                  required
                  className="text-sm font-mono"
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Precio unitario</FieldLabel>
                <Input
                  name="price"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  placeholder="15000"
                  required
                  className="text-sm font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel className="text-xs font-medium">Moneda</FieldLabel>
                <Select
                  value={currency}
                  onValueChange={(v) => setCurrency(v as Currency)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">
                  Comisión{" "}
                  <span className="font-normal text-muted-foreground">opcional</span>
                </FieldLabel>
                <Input
                  name="fee"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className="text-sm font-mono"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel className="text-xs font-medium">Fecha</FieldLabel>
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
                placeholder="Notas sobre la operación..."
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
