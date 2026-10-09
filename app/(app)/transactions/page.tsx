import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { TransactionsClient } from "@/components/transactions/transactions-client";
import { ExpensesSkeleton, TransactionsSkeleton } from "@/components/transactions/transactions-skeleton";
import { ExpensesSection } from "@/components/transactions/expenses-section";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { DividendForm } from "@/components/transactions/dividend-form";
import { CsvExportButton } from "@/components/export/csv-export-button";
import { ImportMovimientosButton } from "@/components/transactions/import-movements-button";
import {
  getAllTransactions,
  calculatePPM,
  getRealizedPnl,
} from "@/app/actions/transactions";
import { getAllDividends } from "@/app/actions/dividends";
import { getMovements } from "@/app/actions/import-movements";
import { getMonthExpenses } from "@/app/actions/expenses";
import { expenseSummary } from "@/lib/expenses";
import { isMonthKey, localDateParts, monthKeyOf } from "@/lib/local-date";

export const metadata: Metadata = { title: "Transacciones" };

type TransactionsSearchParams = Promise<{ mes?: string | string[] }>;

// El header (con sus acciones) y la explicación entran al static shell; los
// gastos del mes (?mes=AAAA-MM) y las operaciones del usuario se leen en
// request time, cada uno detrás de su skeleton.
export default function TransactionsPage({ searchParams }: { searchParams: TransactionsSearchParams }) {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Transacciones"
        description="Operaciones, PPM y dividendos"
        actions={
          <div className="flex items-center gap-1.5">
            <CsvExportButton href="/api/export/transactions" label="Exportar CSV" compact />
            <ImportMovimientosButton compact />
            <DividendForm compact />
            <TransactionForm />
          </div>
        }
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Historial de operaciones
          </p>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Registrá manualmente tus compras, ventas y dividendos para calcular
            el precio promedio de compra y el P&amp;L realizado de tu portfolio.
            Para importar desde Cocos, descargá el CSV desde la sección{" "}
            <strong className="text-foreground">Actividad</strong> —{" "}
            <Link href="/guia#transacciones" className="text-primary underline-offset-4 hover:underline">
              ver guía
            </Link>
            .
          </p>
        </div>

        <Suspense fallback={<ExpensesSkeleton />}>
          <Expenses searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<TransactionsSkeleton />}>
          <Transactions />
        </Suspense>
      </main>
    </div>
  );
}

async function Expenses({ searchParams }: { searchParams: TransactionsSearchParams }) {
  const [{ mes }] = await Promise.all([searchParams, connection()]);
  // La hora no puede leerse durante el prerender: connection() la difiere al
  // request (searchParams sola no alcanza). El mes actual es el de Argentina.
  const today = localDateParts(new Date());
  const currentMonthKey = monthKeyOf(today);
  const requested = Array.isArray(mes) ? mes[0] : mes;
  const monthKey = requested && isMonthKey(requested) && requested <= currentMonthKey ? requested : currentMonthKey;

  const { expenses, previous, usdPayments } = await getMonthExpenses(monthKey);
  return (
    <ExpensesSection
      summary={expenseSummary(expenses, previous, monthKey, today)}
      expenses={expenses}
      currentMonthKey={currentMonthKey}
      usdPayments={usdPayments}
    />
  );
}

async function Transactions() {
  const [transactions, ppmData, realizedPnl, dividends, movements] = await Promise.all([
    getAllTransactions(),
    calculatePPM(),
    getRealizedPnl(),
    getAllDividends(),
    getMovements(),
  ]);

  return (
    <TransactionsClient
      transactions={transactions}
      ppmData={ppmData}
      realizedPnl={realizedPnl}
      dividends={dividends}
      movements={movements}
    />
  );
}
