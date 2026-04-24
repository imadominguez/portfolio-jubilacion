import type { Metadata } from "next";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Target, Scale, PieChart, ArrowRight } from "lucide-react";

import {
  getLatestSnapshot,
  getPreviousSnapshotFull,
  getAllSnapshotPoints,
  type PositionRow,
} from "@/lib/portfolio-data";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { PerformersPanel } from "@/components/dashboard/performers-panel";
import { HoldingsTable } from "@/components/dashboard/holdings-table";
import { AllocationPanel } from "@/components/dashboard/allocation-panel";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { PortfolioChartWidget } from "@/components/dashboard/portfolio-chart-widget";
import { MilestoneWidget } from "@/components/dashboard/milestone-widget";
import { SiteHeader } from "@/components/layout/site-header";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { calculatePPM } from "@/app/actions/transactions";
import { getMarketPrices } from "@/app/actions/market-prices";
import { getTotalDividendsUsd } from "@/app/actions/dividends";
import { getMilestones } from "@/app/actions/milestones";
import { calculateRealGains } from "@/lib/real-gains-data";
import { getRetirementSettings } from "@/app/actions/retirement";
import { getRebalanceData } from "@/app/actions/rebalance";
import { getConcentrationData } from "@/lib/analysis-data";
import { calculateRetirementGoal } from "@/lib/projections";

export const metadata: Metadata = {
  title: "Dashboard",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function HomePage() {
  const [
    snapshot,
    ppmData,
    marketPrices,
    allSnapshots,
    totalDividendsUsd,
    milestones,
    realGains,
    retirementSettings,
    rebalanceData,
    concentrationData,
  ] = await Promise.all([
    getLatestSnapshot(),
    calculatePPM(),
    getMarketPrices(),
    getAllSnapshotPoints(),
    getTotalDividendsUsd(),
    getMilestones(),
    calculateRealGains(),
    getRetirementSettings(),
    getRebalanceData(),
    getConcentrationData(),
  ]);

  let gainArs: number | null = null;
  let gainPct: number | null = null;
  let previousPositions: PositionRow[] = [];

  if (snapshot) {
    const previous = await getPreviousSnapshotFull(snapshot.snapshotDate);
    if (previous) {
      gainArs = snapshot.totalValueArs - previous.totalValueArs;
      gainPct = (gainArs / previous.totalValueArs) * 100;
      previousPositions = previous.positions;
    }
  }

  const isPositive = gainPct !== null ? gainPct >= 0 : true;

  // Compute total unrealized P&L from PPM data vs current prices
  let totalUnrealizedPnlArs: number | null = null;
  if (snapshot && ppmData.length > 0) {
    const ppmMap = new Map(ppmData.map((p) => [p.ticker, p]));
    let sum = 0;
    let hasPpm = false;
    for (const pos of snapshot.positions) {
      const ppm = ppmMap.get(pos.ticker);
      if (ppm && ppm.currency === "ARS" && ppm.avgPrice > 0) {
        sum += (pos.price - ppm.avgPrice) * pos.quantity;
        hasPpm = true;
      }
    }
    if (hasPpm) totalUnrealizedPnlArs = sum;
  }

  const unrealizedIsPositive =
    totalUnrealizedPnlArs !== null ? totalUnrealizedPnlArs >= 0 : true;

  // Rebalanceo: posiciones fuera de objetivo (±1%)
  const rebalanceBuy = rebalanceData.filter((r) => r.suggestedAction === "BUY").length;
  const rebalanceSell = rebalanceData.filter((r) => r.suggestedAction === "SELL").length;
  const rebalanceAlerts = rebalanceBuy + rebalanceSell;

  // Jubilación: calcular si va en camino con tasa conservadora 10% USD anual
  let retirementGoal = null;
  if (retirementSettings && snapshot?.totalValueUsd) {
    retirementGoal = calculateRetirementGoal({
      ...retirementSettings,
      currentPortfolioUsd: snapshot.totalValueUsd,
      annualReturnRate: 0.1,
    });
  }

  // Concentración: sector dominante
  const topSector = concentrationData?.bySector[0] ?? null;
  const totalSectors = concentrationData
    ? concentrationData.bySector.filter((s) => s.name !== "Sin clasificar").length
    : 0;

  // Ganancia real: métricas principales
  const realGainUsd = realGains?.totalGainUsdReal ?? null;
  const realGainAppreciation = realGains?.totalGainUsdAppreciation ?? null;
  const realGainCclImpact = realGains?.totalGainUsdCclImpact ?? null;
  const realGainIsPositive = realGainUsd !== null ? realGainUsd >= 0 : true;
  const realGainCoverage =
    realGains && realGains.positionsTotal > 0
      ? realGains.positionsWithFullData / realGains.positionsTotal
      : null;

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Dashboard" description="CEDEARs · Cocos Capital" actions={<ImportButton />} />

      {snapshot ? (
        <main className="flex-1 px-6 py-10 flex flex-col gap-10 max-w-6xl w-full mx-auto">
          {/* Hero value section */}
          <section className="animate-fade-up flex flex-col gap-6">
            <DashboardHero
              totalValueArs={snapshot.totalValueArs}
              totalValueUsd={snapshot.totalValueUsd}
              snapshotDateFormatted={formatDate(snapshot.snapshotDate)}
              gainArs={gainArs}
              gainPct={gainPct}
            />

            {/* Secondary KPI strip — 6 cards */}
            <div
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 animate-fade-up"
              style={{ animationDelay: "80ms" }}
            >
              {[
                {
                  label: "Equivalente USD",
                  sub: "Tipo de cambio CCL",
                  value: snapshot.totalValueUsd
                    ? formatUSD(snapshot.totalValueUsd)
                    : "—",
                  status: "calculado",
                  accent: null as boolean | null,
                },
                {
                  label: "Tipo de cambio",
                  sub: "CCL implícito",
                  value: snapshot.ccl
                    ? `$ ${new Intl.NumberFormat("es-AR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(snapshot.ccl)}`
                    : "—",
                  status: "del snapshot",
                  accent: null as boolean | null,
                },
                {
                  label: "Posiciones",
                  sub: "CEDEARs activos",
                  value: `${snapshot.positions.length}`,
                  status: "activos",
                  accent: null as boolean | null,
                },
                {
                  label: "Rendimiento",
                  sub: "vs snapshot anterior",
                  value:
                    gainPct !== null
                      ? `${isPositive ? "+" : ""}${gainPct.toFixed(2)}%`
                      : "—",
                  status: gainPct !== null ? "vs anterior" : "sin historial",
                  accent: gainPct !== null ? isPositive : null,
                },
                {
                  label: "P&L no realizado",
                  sub: "precio actual vs PPM",
                  value:
                    totalUnrealizedPnlArs !== null
                      ? `${unrealizedIsPositive ? "+" : ""}${formatARS(totalUnrealizedPnlArs)}`
                      : "—",
                  status:
                    totalUnrealizedPnlArs !== null
                      ? unrealizedIsPositive
                        ? "ganancia latente"
                        : "pérdida latente"
                      : "sin transacciones",
                  accent:
                    totalUnrealizedPnlArs !== null ? unrealizedIsPositive : null,
                },
                {
                  label: "Dividendos",
                  sub: "total cobrado",
                  value: totalDividendsUsd > 0 ? formatUSD(totalDividendsUsd) : "—",
                  status: totalDividendsUsd > 0 ? "acumulado USD" : "sin registros",
                  accent: totalDividendsUsd > 0 ? (true as boolean | null) : null,
                },
              ].map(({ label, sub, value, status, accent }) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground">{sub}</span>
                  </div>
                  <span
                    className={`text-xl font-bold font-mono tabular-nums leading-none ${
                      accent === true
                        ? "text-emerald-500"
                        : accent === false
                          ? "text-destructive"
                          : "text-foreground"
                    }`}
                  >
                    {value}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`size-2 rounded-full shrink-0 ${
                        accent === false ? "bg-destructive" : "bg-emerald-500"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator className="opacity-30" />

          {/* Portfolio evolution chart */}
          <PortfolioChartWidget snapshots={allSnapshots} />

          <Separator className="opacity-30" />

          {/* Feature Insights — acceso rápido a herramientas de análisis */}
          <section className="animate-fade-up flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-semibold text-foreground">Herramientas de análisis</h2>
              <p className="text-xs text-muted-foreground">
                Resumen de las funciones avanzadas del portfolio
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Ganancia Real */}
              <Link
                href="/real-gains"
                className="group rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-500/10 p-1.5">
                      <TrendingUp className="size-4 text-emerald-500" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Ganancia Real</span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span
                    className={`text-xl font-bold font-mono tabular-nums leading-none ${
                      realGainUsd !== null
                        ? realGainIsPositive
                          ? "text-emerald-500"
                          : "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {realGainUsd !== null
                      ? `${realGainIsPositive ? "+" : ""}${formatUSD(realGainUsd)}`
                      : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {realGainAppreciation !== null && realGainCclImpact !== null
                      ? `Subyacente ${realGainAppreciation >= 0 ? "+" : ""}${formatUSD(realGainAppreciation)} · CCL ${realGainCclImpact >= 0 ? "+" : ""}${formatUSD(realGainCclImpact)}`
                      : "Ganancia en USD ajustada por CCL"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-auto">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      realGainCoverage !== null && realGainCoverage >= 0.8
                        ? "bg-emerald-500"
                        : realGainCoverage !== null
                          ? "bg-amber-500"
                          : "bg-muted-foreground/40"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {realGainCoverage !== null
                      ? `${realGains!.positionsWithFullData}/${realGains!.positionsTotal} posiciones con datos`
                      : "sin transacciones registradas"}
                  </span>
                </div>
              </Link>

              {/* Jubilación */}
              <Link
                href="/retirement"
                className="group rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-500/10 p-1.5">
                      <Target className="size-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Jubilación</span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span
                    className={`text-xl font-bold leading-none ${
                      retirementGoal === null
                        ? "text-muted-foreground"
                        : retirementGoal.isOnTrack
                          ? "text-emerald-500"
                          : "text-amber-500"
                    }`}
                  >
                    {retirementGoal === null
                      ? retirementSettings === null
                        ? "Sin configurar"
                        : "—"
                      : retirementGoal.isOnTrack
                        ? "En camino"
                        : "Requiere atención"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {retirementGoal !== null
                      ? `${retirementGoal.yearsRemaining} años restantes · meta ${formatUSD(retirementGoal.capitalNeeded)}`
                      : retirementSettings !== null
                        ? `${retirementSettings.retirementAge - retirementSettings.currentAge} años al retiro`
                        : "Configurá tu plan de retiro"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-auto">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      retirementGoal === null
                        ? "bg-muted-foreground/40"
                        : retirementGoal.isOnTrack
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {retirementGoal !== null
                      ? retirementGoal.isOnTrack
                        ? `Meta alcanzada en ~${retirementGoal.yearsToGoal.toFixed(1)} años`
                        : `Brecha ${formatUSD(retirementGoal.currentGap)}`
                      : retirementSettings !== null
                        ? "configurado · sin valor USD"
                        : "planificación de largo plazo"}
                  </span>
                </div>
              </Link>

              {/* Rebalanceo */}
              <Link
                href="/rebalance"
                className="group rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded-lg p-1.5 ${
                        rebalanceAlerts > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"
                      }`}
                    >
                      <Scale
                        className={`size-4 ${rebalanceAlerts > 0 ? "text-amber-500" : "text-emerald-500"}`}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Rebalanceo</span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span
                    className={`text-xl font-bold font-mono tabular-nums leading-none ${
                      rebalanceData.length === 0
                        ? "text-muted-foreground"
                        : rebalanceAlerts === 0
                          ? "text-emerald-500"
                          : "text-amber-500"
                    }`}
                  >
                    {rebalanceData.length === 0
                      ? "Sin objetivos"
                      : rebalanceAlerts === 0
                        ? "Balanceado"
                        : `${rebalanceAlerts} alerta${rebalanceAlerts > 1 ? "s" : ""}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {rebalanceBuy > 0 || rebalanceSell > 0
                      ? `${rebalanceBuy > 0 ? `${rebalanceBuy} compra${rebalanceBuy > 1 ? "s" : ""}` : ""}${rebalanceBuy > 0 && rebalanceSell > 0 ? " · " : ""}${rebalanceSell > 0 ? `${rebalanceSell} venta${rebalanceSell > 1 ? "s" : ""}` : ""} sugeridas`
                      : rebalanceData.length > 0
                        ? "Todas las posiciones dentro del rango"
                        : "Definí objetivos de asignación por ticker"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-auto">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      rebalanceData.length === 0
                        ? "bg-muted-foreground/40"
                        : rebalanceAlerts === 0
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {rebalanceData.length > 0
                      ? `${rebalanceData.length} posicion${rebalanceData.length > 1 ? "es" : ""} monitoreadas`
                      : "sin objetivos configurados"}
                  </span>
                </div>
              </Link>

              {/* Concentración / Análisis */}
              <Link
                href="/analysis"
                className="group rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-violet-500/10 p-1.5">
                      <PieChart className="size-4 text-violet-500" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Concentración</span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xl font-bold leading-none text-foreground truncate">
                    {topSector !== null ? topSector.name : "Sin datos"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {topSector !== null
                      ? `${topSector.pct.toFixed(1)}% del portfolio · sector dominante`
                      : "Clasificá los assets para ver el análisis"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-auto">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      topSector !== null ? "bg-violet-500" : "bg-muted-foreground/40"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {totalSectors > 0
                      ? `${totalSectors} sector${totalSectors > 1 ? "es" : ""} distintos`
                      : "análisis de concentración"}
                  </span>
                </div>
              </Link>
            </div>
          </section>

          {/* Performers section — only visible when there's a previous snapshot to compare */}
          {previousPositions.length > 0 && (
            <>
              <Separator className="opacity-30" />
              <PerformersPanel
                currentPositions={snapshot.positions}
                previousPositions={previousPositions}
              />
            </>
          )}

          <Separator className="opacity-30" />

          {/* Main content grid */}
          <section className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <AllocationPanel
                positions={snapshot.positions}
                totalArs={snapshot.totalValueArs}
              />
            </div>
            <div className="lg:col-span-3">
              <HoldingsTable positions={snapshot.positions} ppmData={ppmData} marketPrices={marketPrices} />
            </div>
          </section>

          {/* Milestone progress */}
          {snapshot.totalValueUsd !== null && (
            <MilestoneWidget
              milestones={milestones}
              currentValueUsd={snapshot.totalValueUsd}
            />
          )}

          {/* Import hint */}
          <section
            className="animate-fade-up rounded-xl border border-dashed border-border bg-card/50 shadow-sm px-6 py-5 flex items-center justify-between gap-4"
            style={{ animationDelay: "400ms" }}
          >
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">
                Actualizar portfolio
              </p>
              <p className="text-xs text-muted-foreground">
                Importá un nuevo CSV de Cocos Capital para registrar el estado
                actual.
              </p>
            </div>
            <ImportButton />
          </section>
        </main>
      ) : (
        <main className="flex-1 px-6 py-10 max-w-6xl w-full mx-auto">
          <EmptyDashboard />
        </main>
      )}
    </div>
  );
}
