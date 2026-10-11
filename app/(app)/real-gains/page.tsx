import type { Metadata } from "next";
import { Suspense } from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/layout/site-header";
import { RealGainsWizard } from "@/components/real-gains/real-gains-wizard";
import { RealGainsSkeleton } from "@/components/real-gains/real-gains-skeleton";
import { RealGainsUpdateButton } from "@/components/real-gains/real-gains-update-button";
import { StatGrid, type Stat } from "@/components/layout/page-parts";
import { BreakdownBar } from "@/components/real-gains/breakdown-bar";
import { PositionsTable } from "@/components/real-gains/positions-table";
import { MethodologyNote } from "@/components/real-gains/methodology-note";
import { fmtPct } from "@/components/real-gains/real-gains-helpers";
import { getDataReadiness, calculateRealGains } from "@/lib/real-gains-data";
import { formatARS, formatUSD } from "@/lib/format";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";

export const metadata: Metadata = { title: "Ganancia real" };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// El header y la explicación entran al static shell; el análisis se lee en
// request time y se streamea detrás del skeleton.
export default function RealGainsPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Ganancia real"
        description="En dólares: cuánto vino de las acciones y cuánto del CCL"
        actions={
          <Suspense fallback={null}>
            <HeaderUpdateButton />
          </Suspense>
        }
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        {/* Intro */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Cuánto ganaste realmente en dólares, separando lo que subieron las acciones
            en USD de lo que aportó (o costó) la variación del tipo de cambio CCL.
          </p>
        </div>

        <Suspense fallback={<RealGainsSkeleton />}>
          <RealGainsContent />
        </Suspense>
      </main>
    </div>
  );
}

// El botón del header solo aparece si hay análisis: va en su propio <Suspense>
// para no sacar el header del shell. calculateRealGains está cacheada.
async function HeaderUpdateButton() {
  const summary = await calculateRealGains();
  return summary ? <RealGainsUpdateButton /> : null;
}

const toneOf = (v: number | null): Stat["tone"] => (v === null ? null : v >= 0 ? "positive" : "negative");

async function RealGainsContent() {
  const [session, readiness, summary] = await Promise.all([
    getSession(),
    getDataReadiness(),
    calculateRealGains(),
  ]);

  const hasEnoughData =
    readiness.hasSnapshot &&
    readiness.hasTransactions &&
    readiness.hasCclHistory > 0;

  return (
    <>
      {/* Avisos de prerequisitos faltantes */}
      {!readiness.hasSnapshot && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-5 py-4 text-sm text-warning">
          Importá al menos un snapshot desde el Dashboard para comenzar.
        </div>
      )}
      {!readiness.hasTransactions && readiness.hasSnapshot && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-5 py-4 text-sm text-warning">
          Registrá tus transacciones de compra en la página de Transacciones
          para calcular el costo en USD.
        </div>
      )}

      {/* Aviso de históricos desactualizados */}
      {readiness.needsBackfill && (
        <div className="animate-fade-up rounded-xl border border-warning/30 bg-warning/5 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-warning">
                Datos históricos desactualizados
              </span>
              <span className="text-xs text-muted-foreground">
                Hay compras más antiguas que los precios/CCL en caché
                {readiness.tickersMissingHistory.length > 0 &&
                  ` (${readiness.tickersMissingHistory.length} ticker${
                    readiness.tickersMissingHistory.length !== 1 ? "s" : ""
                  })`}
                . Actualizá para incluirlas en el cálculo.
              </span>
            </div>
          </div>
          <RealGainsUpdateButton />
        </div>
      )}

      {/* Gestión de datos históricos — siempre visible */}
      {readiness.hasSnapshot && readiness.hasTransactions && (
        <RealGainsWizard readiness={readiness} />
      )}

      {/* Análisis completo */}
      {summary && summary.positions.length > 0 ? (
        <>
          <Separator className="opacity-30" />

          <StatGrid
            stats={[
              {
                label: "Ganancia en pesos",
                value: formatARS(summary.totalGainArs),
                sub: `${fmtPct(summary.totalGainPctArs)} · valor actual contra costo`,
                tone: toneOf(summary.totalGainArs),
              },
              {
                label: "Ganancia real en dólares",
                value: summary.totalGainUsdReal !== null ? formatUSD(summary.totalGainUsdReal) : "—",
                sub: summary.totalGainPctUsdReal !== null ? `${fmtPct(summary.totalGainPctUsdReal)} · cada compra al CCL de su fecha` : "Cada compra al CCL de su fecha",
                tone: toneOf(summary.totalGainUsdReal),
              },
              {
                label: "Suba de las acciones",
                value: summary.totalGainUsdAppreciation !== null ? formatUSD(summary.totalGainUsdAppreciation) : "—",
                sub: summary.totalGainPctUsdAppreciation !== null ? `${fmtPct(summary.totalGainPctUsdAppreciation)} · precio del subyacente en dólares` : "Precio del subyacente en dólares",
                tone: toneOf(summary.totalGainUsdAppreciation),
              },
              {
                label: "Efecto del CCL",
                value: summary.totalGainUsdCclImpact !== null ? formatUSD(summary.totalGainUsdCclImpact) : "—",
                sub: (summary.totalGainUsdCclImpact ?? 0) < 0 ? "El CCL te restó ganancia" : "El CCL te sumó ganancia",
                tone: toneOf(summary.totalGainUsdCclImpact),
                glossary: "ccl" as const,
              },
            ]}
          />

          <Separator className="opacity-30" />

          {/* Barra de desglose */}
          {summary.totalGainUsdAppreciation !== null && (
            <BreakdownBar summary={summary} />
          )}

          {/* Tabla de posiciones */}
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Detalle por posición
            </h2>
            <PositionsTable
              summary={summary}
              canManageAssets={isAdminRole(session?.user.role)}
            />
          </div>

          {/* Nota metodológica */}
          <MethodologyNote summary={summary} />
        </>
      ) : (
        hasEnoughData && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Sin posiciones para analizar</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Las posiciones del snapshot no coinciden con las transacciones registradas.
              Verificá que los tickers del CSV coincidan con los de la página de Transacciones.
            </p>
          </div>
        )
      )}
    </>
  );
}
