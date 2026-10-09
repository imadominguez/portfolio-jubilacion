import type { Metadata } from "next";
import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

import {
  getLatestSnapshot,
  getPreviousSnapshotFull,
  getAllSnapshotPoints,
  getHoldingsFlows,
  type PositionRow,
} from "@/lib/portfolio-data";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardKpiStrip } from "@/components/dashboard/dashboard-kpi-strip";
import { AnalysisTools } from "@/components/dashboard/analysis-tools";
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
import { getAllExchangeRates } from "@/app/actions/exchange-rate";
import { liveValuation } from "@/lib/live-valuation";
import { getTotalDividendsUsd } from "@/app/actions/dividends";
import { getMilestones } from "@/app/actions/milestones";
import { calculateRealGains } from "@/lib/real-gains-data";
import { getRetirementSettings } from "@/app/actions/retirement";
import { getLatestSignals } from "@/app/actions/reports";
import { getConcentrationData } from "@/lib/analysis-data";
import { getSetupStatus } from "@/app/actions/setup";
import { calculateRetirementGoal } from "@/lib/projections";
import { SetupPanel } from "@/components/setup/setup-panel";
import { formatDateMedium } from "@/lib/format";
import { modifiedDietz, netContributions } from "@/lib/flow-returns";

export const metadata: Metadata = {
  title: "Dashboard",
};

// El header entra al static shell; los datos del usuario se leen en request
// time y se streamean detrás del skeleton.
export default function HomePage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Dashboard" description="CEDEARs · Cocos Capital" actions={<ImportButton />} />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const [snapshot, setupStatus] = await Promise.all([
    getLatestSnapshot(),
    getSetupStatus(),
  ]);

  // Sin snapshot inicial no tiene sentido consultar el resto de las métricas.
  if (!snapshot) {
    return (
      <main className="flex-1 px-6 py-10 max-w-6xl w-full mx-auto">
        <SetupPanel status={setupStatus} showChecklist={false} />
        <EmptyDashboard />
      </main>
    );
  }

  const [
    ppmData,
    marketPrices,
    allSnapshots,
    totalDividendsUsd,
    milestones,
    realGains,
    retirementSettings,
    latestSignals,
    concentrationData,
    previous,
    holdingsFlows,
    exchangeRates,
  ] = await Promise.all([
    calculatePPM(),
    getMarketPrices(),
    getAllSnapshotPoints(),
    getTotalDividendsUsd(),
    getMilestones(),
    calculateRealGains(),
    getRetirementSettings(),
    getLatestSignals(),
    getConcentrationData(),
    getPreviousSnapshotFull(snapshot.snapshotDate),
    getHoldingsFlows(),
    getAllExchangeRates(),
  ]);

  let gainArs: number | null = null;
  let gainPct: number | null = null;
  let previousPositions: PositionRow[] = [];

  if (previous) {
    // Sin contar compras, ventas ni movimientos del FCI del período (ADR-0019):
    // la diferencia de valor sola mezcla aportes con rendimiento.
    const start = { date: previous.snapshotDate, value: previous.totalValueArs };
    const end = { date: snapshot.snapshotDate, value: snapshot.totalValueArs };
    const periodFlows = holdingsFlows.flowsArs.filter(
      (f) => f.date > previous.snapshotDate && f.date <= snapshot.snapshotDate,
    );
    gainArs =
      end.value - start.value - netContributions(holdingsFlows.flowsArs, start.date, end.date);
    gainPct = modifiedDietz(start, end, periodFlows);
    previousPositions = previous.positions;
  }

  const isPositive = gainPct !== null ? gainPct >= 0 : true;

  // Compute total unrealized P&L from PPM data vs current prices
  let totalUnrealizedPnlArs: number | null = null;
  if (ppmData.length > 0) {
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

  // La misma tenencia con los precios del día (el snapshot puede tener semanas).
  const live = snapshot.ccl
    ? liveValuation({
        positions: snapshot.positions,
        prices: marketPrices,
        ppm: ppmData.filter((p) => p.currency === "ARS"),
        snapshotCcl: snapshot.ccl,
        currentCcl: exchangeRates.at(-1)?.ccl ?? null,
      })
    : null;
  const liveAsOfLabel = live?.pricesAsOf
    ? new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "short",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(live.pricesAsOf)
    : null;

  // Jubilación: calcular si va en camino con tasa conservadora 10% USD anual
  let retirementGoal = null;
  if (retirementSettings && snapshot.totalValueUsd) {
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

  return (
    <main className="flex-1 px-6 py-10 flex flex-col gap-10 max-w-6xl w-full mx-auto">
      <SetupPanel status={setupStatus} />

      {/* Hero value section */}
      <section className="animate-fade-up flex flex-col gap-6">
        <DashboardHero
          totalValueArs={snapshot.totalValueArs}
          totalValueUsd={snapshot.totalValueUsd}
          snapshotDateFormatted={formatDateMedium(snapshot.snapshotDate)}
          gainArs={gainArs}
          gainPct={gainPct}
          live={live && liveAsOfLabel ? { valueArs: live.valueArs, valueUsd: live.valueUsd, asOfLabel: liveAsOfLabel } : null}
        />

        <DashboardKpiStrip
          totalValueUsd={snapshot.totalValueUsd}
          ccl={snapshot.ccl}
          positionCount={snapshot.positions.length}
          gainPct={gainPct}
          isPositive={isPositive}
          totalUnrealizedPnlArs={totalUnrealizedPnlArs}
          unrealizedIsPositive={unrealizedIsPositive}
          liveUnrealizedPnlArs={live?.unrealizedPnlArs ?? null}
          totalDividendsUsd={totalDividendsUsd}
        />
      </section>

      <Separator className="opacity-30" />

      {/* Portfolio evolution chart */}
      <PortfolioChartWidget snapshots={allSnapshots} />

      <Separator className="opacity-30" />

      <AnalysisTools
        realGains={realGains}
        retirementGoal={retirementGoal}
        retirementSettings={retirementSettings}
        latestSignals={
          latestSignals
            ? {
                buy: Object.values(latestSignals.signals).filter((s) => s.senal === "compra").length,
                dateLabel: new Intl.DateTimeFormat("es-AR", {
                  day: "2-digit",
                  month: "short",
                  timeZone: "America/Argentina/Buenos_Aires",
                }).format(latestSignals.createdAt),
              }
            : null
        }
        topSector={topSector}
        totalSectors={totalSectors}
      />

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
        <div className="min-w-0 lg:col-span-2">
          <AllocationPanel
            positions={snapshot.positions}
            totalArs={snapshot.totalValueArs}
          />
        </div>
        <div className="min-w-0 lg:col-span-3">
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
  );
}
