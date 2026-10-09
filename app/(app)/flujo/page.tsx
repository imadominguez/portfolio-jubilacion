import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeftRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportMovimientosButton } from "@/components/transactions/import-movements-button";
import { CashFlowChart } from "@/components/cash-flow/cash-flow-chart";
import { CashFlowSkeleton } from "@/components/cash-flow/cash-flow-skeleton";
import { getCashFlow } from "@/app/actions/cash-flow";
import { cashFlowSummary, type MonthCashFlow } from "@/lib/cash-flow";
import { formatARS } from "@/lib/format";
import { localDateParts, monthKeyOf, monthLabel } from "@/lib/local-date";

export const metadata: Metadata = { title: "Flujo de caja" };

// El header y la explicación entran al static shell; los movimientos del
// usuario se leen en request time detrás del skeleton.
export default function CashFlowPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Flujo de caja" description="Depósitos, gastos y ahorro" />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Cuenta de Cocos
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Cuánto depositaste cada mes, cuánto gastaste desde la cuenta y cuánto quedó para invertir. Sale
            del CSV de Actividad, así que solo ve lo que pasa por Cocos: lo que cobrás o gastás por otro lado
            no está.
          </p>
        </div>

        <Suspense fallback={<CashFlowSkeleton />}>
          <CashFlowContent />
        </Suspense>
      </main>
    </div>
  );
}

function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)}%`;
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span
        className={`text-xl font-bold font-mono tabular-nums leading-none ${
          tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

async function CashFlowContent() {
  const [months] = await Promise.all([getCashFlow(), connection()]);
  // Después de connection(): la hora no puede leerse durante el prerender.
  const currentKey = monthKeyOf(localDateParts(new Date()));

  if (months.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="Sin movimientos todavía"
        description="Importá el CSV de Actividad de Cocos para ver tus depósitos, gastos y ahorro por mes."
        action={<ImportMovimientosButton />}
      />
    );
  }

  // El resumen usa los meses cerrados: el mes en curso todavía no terminó.
  const closed = months.filter((m) => m.monthKey < currentKey).slice(-12);
  const summary = cashFlowSummary(closed);
  const current = months.find((m) => m.monthKey === currentKey) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <section className="animate-fade-up flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Últimos {summary.months} {summary.months === 1 ? "mes cerrado" : "meses cerrados"}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Depositado" value={formatARS(summary.deposits)} sub={`${formatARS(summary.deposits / Math.max(1, summary.months))} por mes`} />
          <Kpi
            label="Gastado"
            value={formatARS(summary.expenses)}
            sub={`${formatARS(summary.averageMonthlyExpenses)} por mes`}
          />
          <Kpi
            label="Tasa de ahorro"
            value={pct(summary.savingsRate)}
            sub={`Ahorro ${formatARS(summary.savings)} (depósitos − gastos)`}
            tone={summary.savingsRate === null ? undefined : summary.savingsRate >= 0 ? "good" : "bad"}
          />
          <Kpi label="Invertido en CEDEARs y bonos" value={formatARS(summary.invested)} sub="Compras menos ventas, neto" />
        </div>
      </section>

      <section className="animate-fade-up rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Depósitos y gastos por mes, con la tasa de ahorro</p>
        <CashFlowChart months={months} />
      </section>

      <section className="animate-fade-up flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Mes a mes</h2>
        <p className="text-xs text-muted-foreground -mt-1 max-w-2xl">
          Una tasa negativa es un mes en que gastaste más de lo que depositaste: la diferencia salió del FCI o
          del efectivo de la cuenta. FCI neto positivo es plata que quedó estacionada en el fondo.
        </p>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground/70">
                <th className="px-4 py-2.5 text-left font-semibold">Mes</th>
                <th className="px-3 py-2.5 text-right font-semibold">Depósitos</th>
                <th className="px-3 py-2.5 text-right font-semibold">Gastos</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ahorro</th>
                <th className="px-3 py-2.5 text-right font-semibold">Tasa</th>
                <th className="px-3 py-2.5 text-right font-semibold">Invertido</th>
                <th className="px-4 py-2.5 text-right font-semibold">FCI neto</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <MonthRow key={m.monthKey} month={m} isCurrent={m.monthKey === currentKey} />
              ))}
            </tbody>
          </table>
        </div>
        {current && (
          <p className="text-xs text-muted-foreground">
            {monthLabel(current.monthKey)} está en curso.{" "}
            <Link href="/transactions" className="text-primary underline-offset-4 hover:underline">
              Ver los gastos del mes
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

function MonthRow({ month: m, isCurrent }: { month: MonthCashFlow; isCurrent: boolean }) {
  const num = "px-3 py-2.5 text-right font-mono tabular-nums text-xs";
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-4 py-2.5 whitespace-nowrap">
        <Link
          href={isCurrent ? "/transactions" : `/transactions?mes=${m.monthKey}`}
          className="capitalize text-foreground hover:text-primary"
        >
          {monthLabel(m.monthKey)}
        </Link>
        {isCurrent && <span className="ml-1.5 text-[11px] text-muted-foreground">(en curso)</span>}
      </td>
      <td className={num}>{formatARS(m.deposits)}</td>
      <td className={num}>{formatARS(m.expenses)}</td>
      <td className={`${num} ${m.savings >= 0 ? "text-success" : "text-destructive"}`}>{formatARS(m.savings)}</td>
      <td className={`${num} ${m.savingsRate === null ? "text-muted-foreground" : m.savingsRate >= 0 ? "text-success" : "text-destructive"}`}>
        {pct(m.savingsRate)}
      </td>
      <td className={`${num} text-muted-foreground`}>{m.invested === 0 ? "—" : formatARS(m.invested)}</td>
      <td className={`px-4 ${num} text-muted-foreground`}>{Math.round(m.fciNet) === 0 ? "—" : formatARS(m.fciNet)}</td>
    </tr>
  );
}
