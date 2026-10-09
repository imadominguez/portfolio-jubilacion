"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveExpenseBudgets } from "@/app/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";

// Presupuesto mensual por categoría. Vacío o 0 = sin presupuesto.
export function BudgetsDialog({ budgets }: { budgets: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, budgets[c.id] ? String(budgets[c.id]) : ""]))
  );
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const payload = Object.fromEntries(
      EXPENSE_CATEGORIES.map((c) => {
        const raw = values[c.id].trim();
        return [c.id, raw === "" ? null : Number(raw)];
      })
    );
    startTransition(async () => {
      const result = await saveExpenseBudgets(payload);
      if (result.success) {
        toast.success("Presupuestos guardados");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Al abrir, parte de lo guardado (con <Activity> el estado sobrevive a la navegación).
        if (next) setValues(Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, budgets[c.id] ? String(budgets[c.id]) : ""])));
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <PiggyBank className="size-3.5" />
          Presupuestos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Presupuesto mensual por categoría</DialogTitle>
          <DialogDescription>
            En pesos. Dejá vacío para no tener presupuesto. Si tenés las alertas activadas, te avisamos por mail una vez
            por mes cuando una categoría lo supera.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <div key={c.id} className="flex flex-col gap-1">
              <Label htmlFor={`budget-${c.id}`} className="text-xs">
                {c.label}
              </Label>
              <Input
                id={`budget-${c.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                placeholder="Sin presupuesto"
                value={values[c.id]}
                onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                className="h-8 font-mono tabular-nums"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Spinner />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
