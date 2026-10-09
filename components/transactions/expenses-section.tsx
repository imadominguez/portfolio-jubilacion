import Link from "next/link";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpensesDailyChart } from "@/components/transactions/expenses-daily-chart";
import { ExpensesTable } from "@/components/transactions/expenses-table";
import { formatARS } from "@/lib/format";
import { monthLabel, shiftMonth } from "@/lib/local-date";
import type { Expense, ExpenseSummary } from "@/lib/expenses";

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span
        className={`text-xl font-bold font-mono tabular-nums leading-none ${
          tone === "up" ? "text-destructive" : tone === "down" ? "text-success" : "text-foreground"
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

export function ExpensesSection({
  summary,
  expenses,
  currentMonthKey,
  usdPayments,
}: {
  summary: ExpenseSummary;
  expenses: Expense[];
  currentMonthKey: string;
  usdPayments: number;
}) {
  const { monthKey } = summary;
  const prevKey = shiftMonth(monthKey, -1);
  const nextKey = shiftMonth(monthKey, 1);
  const hasNext = nextKey <= currentMonthKey;
  const monthHref = (key: string) => (key === currentMonthKey ? "/transactions" : `/transactions?mes=${key}`);

  // Contra el mes anterior hasta el mismo día: a mitad de mes, comparar con el
  // mes anterior completo siempre daría "gastaste menos".
  const comparison = summary.isCurrentMonth ? summary.previousSameDay : summary.previousTotal;
  const diffPct = comparison > 0 ? ((summary.total - comparison) / comparison) * 100 : null;
  const comparisonLabel = summary.isCurrentMonth
    ? `vs ${monthLabel(prevKey).split(" ")[0]} al día ${summary.elapsedDays} (${formatARS(comparison)})`
    : `vs ${monthLabel(prevKey)} (${formatARS(comparison)})`;

  return (
    <section className="animate-fade-up flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">Gastos del mes</h2>
          <p className="text-xs text-muted-foreground">
            Los pagos (&quot;Orden De Pago&quot;) del CSV de Actividad de Cocos, en pesos.
          </p>
        </div>
        <nav aria-label="Mes" className="flex items-center gap-1">
          <Button asChild size="icon-sm" variant="ghost" aria-label="Mes anterior">
            <Link href={monthHref(prevKey)}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <span className="min-w-36 text-center text-sm font-medium capitalize">{monthLabel(monthKey)}</span>
          {hasNext ? (
            <Button asChild size="icon-sm" variant="ghost" aria-label="Mes siguiente">
              <Link href={monthHref(nextKey)}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button size="icon-sm" variant="ghost" aria-label="Mes siguiente" disabled>
              <ChevronRight className="size-4" />
            </Button>
          )}
        </nav>
      </div>

      {summary.count === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-10 text-center">
          <Wallet className="size-6 text-muted-foreground/50" />
          <p className="text-sm text-foreground">Sin pagos en {monthLabel(monthKey)}</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Importá el CSV de Actividad de Cocos con el botón de arriba para ver los gastos del mes.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Gastado"
              value={formatARS(summary.total)}
              sub={`${summary.count} ${summary.count === 1 ? "pago" : "pagos"}`}
            />
            <Kpi
              label="Promedio por día"
              value={formatARS(summary.dailyAverage)}
              sub={`Sobre ${summary.elapsedDays} ${summary.elapsedDays === 1 ? "día" : "días"}`}
            />
            {summary.projection !== null ? (
              <Kpi
                label="Proyección del mes"
                value={formatARS(summary.projection)}
                sub={`Si seguís al mismo ritmo hasta el ${summary.daysInMonth}`}
              />
            ) : (
              <Kpi label="Días del mes" value={String(summary.daysInMonth)} sub="Mes cerrado" />
            )}
            <Kpi
              label="Contra el mes anterior"
              value={diffPct === null ? "—" : `${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
              sub={comparison > 0 ? comparisonLabel : "Sin pagos el mes anterior"}
              tone={diffPct === null ? undefined : diffPct > 0 ? "up" : "down"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <div className="min-w-0 rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Gasto por día</p>
              <ExpensesDailyChart days={summary.byDay} />
            </div>

            <div className="min-w-0 rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Por categoría
                {summary.uncategorized > 0 &&
                  ` · ${summary.uncategorized} ${summary.uncategorized === 1 ? "pago" : "pagos"} sin categoría`}
              </p>
              <ul className="flex flex-col gap-2.5">
                {summary.byCategory.map((c) => (
                  <li key={c.category} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className={c.category === "sin-categoria" ? "text-muted-foreground" : "text-foreground"}>
                        {c.label}
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        {formatARS(c.total)}
                        <span className="text-muted-foreground"> · {c.pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${c.category === "sin-categoria" ? "bg-muted-foreground/40" : "bg-primary"}`}
                        style={{ width: `${Math.max(0, Math.min(100, c.pct))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {usdPayments > 0 && (
            <p className="text-xs text-muted-foreground">
              {usdPayments} {usdPayments === 1 ? "pago en dólares no está" : "pagos en dólares no están"} en los totales.
            </p>
          )}

          <ExpensesTable key={monthKey} expenses={expenses} />
        </>
      )}
    </section>
  );
}
