import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { TransactionsClient } from "@/components/transactions/transactions-client";
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

export const metadata: Metadata = { title: "Transacciones" };

export default async function TransactionsPage() {
  const [transactions, ppmData, realizedPnl, dividends] = await Promise.all([
    getAllTransactions(),
    calculatePPM(),
    getRealizedPnl(),
    getAllDividends(),
  ]);

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Transacciones"
        description="Operaciones, PPM y dividendos"
        actions={
          <div className="flex items-center gap-1.5">
            <CsvExportButton href="/api/export/transactions" label="Exportar CSV" />
            <ImportMovimientosButton />
            <DividendForm />
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
            el precio promedio de compra y el P&L realizado de tu portfolio.
          </p>
        </div>

        <TransactionsClient
          transactions={transactions}
          ppmData={ppmData}
          realizedPnl={realizedPnl}
          dividends={dividends}
        />
      </main>
    </div>
  );
}
