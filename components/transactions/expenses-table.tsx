"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { saveExpenseTag } from "@/app/actions/expenses";
import { EXPENSE_CATEGORIES, expenseCategoryLabel, type Expense } from "@/lib/expenses";
import { formatARS } from "@/lib/format";

// Lista de pagos del mes con su categoría y nota editables. Guarda al cambiar
// la categoría o al salir del campo de nota; la página vuelve a leer los
// totales con revalidateExpenses.

// Radix Select no admite un ítem con valor vacío: "sin categoría" usa este.
const NONE = "none";

// El mes ya está en el título de la sección: alcanza con día y mes.
const SHORT_DATE = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" });
export function ExpensesTable({
  expenses,
  suggestions,
}: {
  expenses: Expense[];
  // Categoría sugerida por id de pago (mismo monto que uno ya categorizado).
  suggestions: Record<string, string>;
}) {
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const rows = onlyUncategorized ? expenses.filter((e) => e.category === null) : expenses;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Cocos no dice a quién pagaste: elegí la categoría y, si querés, anotá el comercio.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Switch id="only-uncategorized" size="sm" checked={onlyUncategorized} onCheckedChange={setOnlyUncategorized} />
          <Label htmlFor="only-uncategorized" className="text-xs font-normal">
            Solo sin categoría
          </Label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {onlyUncategorized ? "Todos los pagos del mes tienen categoría." : "No hay pagos en este mes."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((e) => (
              <ExpenseRow key={`${e.id}-${e.category}-${e.note}`} expense={e} suggestion={suggestions[e.id] ?? null} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ expense, suggestion }: { expense: Expense; suggestion: string | null }) {
  const [category, setCategory] = useState(expense.category ?? "");
  const [note, setNote] = useState(expense.note ?? "");
  const [isPending, startTransition] = useTransition();

  function save(nextCategory: string, nextNote: string) {
    if (nextCategory === (expense.category ?? "") && nextNote.trim() === (expense.note ?? "")) return;
    startTransition(async () => {
      const result = await saveExpenseTag(expense.id, nextCategory || null, nextNote);
      if (!result.success) {
        toast.error(result.error);
        setCategory(expense.category ?? "");
        setNote(expense.note ?? "");
      }
    });
  }

  return (
    <li className="px-4 py-2.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 sm:grid-cols-[4rem_8rem_minmax(0,14rem)_1fr] sm:items-center">
      <span className="text-xs font-mono text-muted-foreground">{SHORT_DATE.format(expense.date)}</span>
      <span
        className={`text-sm font-mono tabular-nums text-right sm:text-left ${expense.amount < 0 ? "text-success" : "text-foreground"}`}
      >
        {expense.amount < 0 ? `+${formatARS(-expense.amount)}` : formatARS(expense.amount)}
      </span>
      <Select
        value={category || NONE}
        disabled={isPending}
        onValueChange={(value) => {
          const next = value === NONE ? "" : value;
          setCategory(next);
          save(next, note);
        }}
      >
        <SelectTrigger size="sm" aria-label="Categoría" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectItem value={NONE} className="text-muted-foreground">
            Sin categoría
          </SelectItem>
          <SelectSeparator />
          {EXPENSE_CATEGORIES.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {suggestion && !category && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setCategory(suggestion);
            save(suggestion, note);
          }}
          className="col-span-2 justify-self-start rounded-md border border-dashed border-primary/40 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10 sm:col-span-1 sm:col-start-3"
          title="Mismo monto que un pago que ya categorizaste"
        >
          ¿{expenseCategoryLabel(suggestion)}?
        </button>
      )}
      <Input
        aria-label="Nota"
        placeholder="Nota (ej. Coto, luz)"
        maxLength={120}
        className="h-7 text-xs"
        value={note}
        disabled={isPending}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => save(category, note)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </li>
  );
}
