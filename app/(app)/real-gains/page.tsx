import type { Metadata } from "next";
import {
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/layout/site-header";
import { RealGainsWizard } from "@/components/real-gains/real-gains-wizard";
import { RealGainsUpdateButton } from "@/components/real-gains/real-gains-update-button";
import { KpiCard } from "@/components/real-gains/kpi-card";
import { BreakdownBar } from "@/components/real-gains/breakdown-bar";
import { PositionsTable } from "@/components/real-gains/positions-table";
import { MethodologyNote } from "@/components/real-gains/methodology-note";
import { fmtPct } from "@/components/real-gains/real-gains-helpers";
import { getDataReadiness, calculateRealGains } from "@/lib/real-gains-data";
import { formatARS, formatUSD } from "@/lib/format";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = { title: "Ganancia Real en USD" };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RealGainsPage() {
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
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Ganancia Real"
        description="Desglose en USD · CCL · Apreciación"
        actions={summary ? <RealGainsUpdateButton /> : undefined}
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        {/* Intro */}
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Análisis avanzado
          </p>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Cuánto ganaste realmente en dólares, separando lo que subieron las acciones
            en USD de lo que aportó (o costó) la variación del tipo de cambio CCL.
          </p>
        </div>

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

            {/* KPIs */}
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Ganancia en ARS"
                sub="valor actual vs costo total"
                value={formatARS(summary.totalGainArs)}
                pct={fmtPct(summary.totalGainPctArs)}
                positive={summary.totalGainArs >= 0 ? true : false}
                icon={BarChart3}
                delay={0}
              />
              <KpiCard
                label="Ganancia USD real"
                sub="conversión por CCL histórico"
                value={summary.totalGainUsdReal !== null ? formatUSD(summary.totalGainUsdReal) : "—"}
                pct={
                  summary.totalGainPctUsdReal !== null
                    ? fmtPct(summary.totalGainPctUsdReal)
                    : null
                }
                positive={
                  summary.totalGainUsdReal !== null
                    ? summary.totalGainUsdReal >= 0
                    : null
                }
                icon={DollarSign}
                delay={60}
              />
              <KpiCard
                label="Apreciación acciones"
                sub="suba del subyacente en USD"
                value={
                  summary.totalGainUsdAppreciation !== null
                    ? formatUSD(summary.totalGainUsdAppreciation)
                    : "—"
                }
                pct={
                  summary.totalGainPctUsdAppreciation !== null
                    ? fmtPct(summary.totalGainPctUsdAppreciation)
                    : null
                }
                positive={
                  summary.totalGainUsdAppreciation !== null
                    ? summary.totalGainUsdAppreciation >= 0
                    : null
                }
                icon={TrendingUp}
                delay={120}
              />
              <KpiCard
                label="Impacto CCL"
                sub={
                  (summary.totalGainUsdCclImpact ?? 0) < 0
                    ? "CCL diluyó ganancias"
                    : "CCL aportó ganancias"
                }
                value={
                  summary.totalGainUsdCclImpact !== null
                    ? formatUSD(summary.totalGainUsdCclImpact)
                    : "—"
                }
                positive={
                  summary.totalGainUsdCclImpact !== null
                    ? summary.totalGainUsdCclImpact >= 0
                    : null
                }
                icon={
                  (summary.totalGainUsdCclImpact ?? 0) >= 0
                    ? ArrowUpRight
                    : ArrowDownRight
                }
                delay={180}
              />
            </section>

            <Separator className="opacity-30" />

            {/* Barra de desglose */}
            {summary.totalGainUsdAppreciation !== null && (
              <BreakdownBar summary={summary} />
            )}

            {/* Tabla de posiciones */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
                Detalle por posición
              </p>
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
      </main>
    </div>
  );
}
