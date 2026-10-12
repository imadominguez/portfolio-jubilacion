import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

import {
  getLatestSnapshot,
  getPreviousSnapshotFull,
  getAllSnapshotPoints,
  getHoldingsFlows,
} from "@/lib/portfolio-data";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardKpiStrip } from "@/components/dashboard/dashboard-kpi-strip";
import { ThisMonth } from "@/components/dashboard/this-month";
import { TopHoldings } from "@/components/dashboard/top-holdings";
import { PendingAssetsBanner } from "@/components/dashboard/pending-assets-banner";
import { getMyAssetStatus } from "@/app/actions/asset-requests";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { PortfolioChartWidget } from "@/components/dashboard/portfolio-chart-widget";
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
import { getViewerRole } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";
import { calculateRetirementGoal } from "@/lib/projections";
import { SetupPanel } from "@/components/setup/setup-panel";
import { formatDateMedium } from "@/lib/format";
import { ageLabel, daysSince, localDateParts } from "@/lib/local-date";
import { modifiedDietz, netContributions, returnSummary } from "@/lib/flow-returns";
import { performanceSeries } from "@/lib/snapshot-returns";

export const metadata: Metadata = {
  title: "Dashboard",
};

const AR_SHORT_DATE = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

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
  const [snapshot, setupStatus, role, assetStatus] = await Promise.all([
    getLatestSnapshot(),
    getSetupStatus(),
    getViewerRole(),
    getMyAssetStatus(),
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
    // Lee datos globales con connection(): después de esto la hora ya es usable.
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

  const today = localDateParts(new Date());
  const isAdmin = isAdminRole(role);

  // Sin contar compras, ventas ni movimientos del FCI del período (ADR-0019):
  // la diferencia de valor sola mezcla aportes con rendimiento.
  let period: { pct: number; gainArs: number; sinceLabel: string } | null = null;
  if (previous) {
    const start = { date: previous.snapshotDate, value: previous.totalValueArs };
    const end = { date: snapshot.snapshotDate, value: snapshot.totalValueArs };
    const periodFlows = holdingsFlows.flowsArs.filter(
      (f) => f.date > previous.snapshotDate && f.date <= snapshot.snapshotDate,
    );
    const pct = modifiedDietz(start, end, periodFlows);
    if (pct !== null) {
      period = {
        pct,
        gainArs: end.value - start.value - netContributions(holdingsFlows.flowsArs, start.date, end.date),
        sinceLabel: `desde el ${formatDateMedium(previous.snapshotDate)}`,
      };
    }
  }

  // Rendimiento del año en curso sin aportes, en pesos y en dólares (como en /performance).
  const series = performanceSeries(allSnapshots);
  const usdSeries = series.filter((s) => s.totalValueUsd !== null && s.totalValueUsd > 0);
  const arsYear = returnSummary(
    series.map((s) => ({ date: s.snapshotDate, value: s.totalValueArs })),
    holdingsFlows.flowsArs,
    today.year,
  );
  const usdYear = returnSummary(
    usdSeries.map((s) => ({ date: s.snapshotDate, value: s.totalValueUsd! })),
    holdingsFlows.flowsUsd,
    today.year,
  );
  const year =
    arsYear || usdYear
      ? {
          year: today.year,
          ars: arsYear ? { pct: arsYear.yearReturnPct, gain: arsYear.yearGain } : null,
          usd: usdYear ? { pct: usdYear.yearReturnPct, gain: usdYear.yearGain } : null,
        }
      : null;

  // P&L no realizado contra el PPM, al precio del snapshot.
  const ppmByTicker = new Map(ppmData.map((p) => [p.ticker, p.avgPrice]));
  let unrealizedArs: number | null = null;
  for (const pos of snapshot.positions) {
    const avg = ppmByTicker.get(pos.ticker);
    if (avg && avg > 0) unrealizedArs = (unrealizedArs ?? 0) + (pos.price - avg) * pos.quantity;
  }

  // La misma tenencia con los precios del día (el snapshot puede tener semanas).
  const live = snapshot.ccl
    ? liveValuation({
        positions: snapshot.positions,
        prices: marketPrices,
        ppm: ppmData,
        snapshotCcl: snapshot.ccl,
        currentCcl: exchangeRates.at(-1)?.ccl ?? null,
      })
    : null;

  const retirementGoal =
    retirementSettings && snapshot.totalValueUsd
      ? calculateRetirementGoal({
          ...retirementSettings,
          currentPortfolioUsd: snapshot.totalValueUsd,
          // El retorno configurado, el mismo que usa /retirement.
          annualReturnRate: retirementSettings.expectedReturnRate,
        })
      : null;

  const snapshotAgeDays = daysSince(snapshot.snapshotDate, today);
  const nextMilestone = milestones.find((m) => !m.reached) ?? null;
  const topSector = concentrationData?.bySector.find((s) => s.name !== "Sin clasificar") ?? null;

  return (
    <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
      <SetupPanel status={setupStatus} collapsible />
      <PendingAssetsBanner status={assetStatus} isAdmin={isAdmin} />

      <DashboardHero
        totalValueArs={snapshot.totalValueArs}
        totalValueUsd={snapshot.totalValueUsd}
        snapshotDateLabel={formatDateMedium(snapshot.snapshotDate)}
        snapshotAgeDays={snapshotAgeDays}
        snapshotAgeLabel={ageLabel(snapshotAgeDays)}
        ccl={snapshot.ccl}
        live={
          live?.pricesAsOf
            ? { valueArs: live.valueArs, valueUsd: live.valueUsd, asOfLabel: AR_SHORT_DATE.format(live.pricesAsOf) }
            : null
        }
        year={year}
        retirement={
          retirementGoal && retirementSettings
            ? {
                retirementAge: retirementSettings.retirementAge,
                projectedUsd: retirementGoal.capitalAtRetirement,
                neededUsd: retirementGoal.capitalNeeded,
                isOnTrack: retirementGoal.isOnTrack,
              }
            : null
        }
      />

      <DashboardKpiStrip
        period={period}
        unrealized={
          unrealizedArs !== null ? { snapshotArs: unrealizedArs, todayArs: live?.unrealizedPnlArs ?? null } : null
        }
        realGain={
          realGains?.totalGainUsdReal != null
            ? {
                usd: realGains.totalGainUsdReal,
                pct: realGains.totalGainPctUsdReal,
                appreciationUsd: realGains.totalGainUsdAppreciation,
                cclUsd: realGains.totalGainUsdCclImpact,
              }
            : null
        }
        dividendsUsd={totalDividendsUsd}
      />

      <ThisMonth
        isAdmin={isAdmin}
        dca={
          latestSignals
            ? {
                buy: Object.values(latestSignals.signals).filter((s) => s.senal === "compra").length,
                dateLabel: AR_SHORT_DATE.format(latestSignals.createdAt),
              }
            : null
        }
        milestone={
          nextMilestone && snapshot.totalValueUsd !== null
            ? { label: nextMilestone.label, targetUsd: nextMilestone.targetValueUsd, currentUsd: snapshot.totalValueUsd }
            : null
        }
        allMilestonesReached={milestones.length > 0 && !nextMilestone}
        topSector={topSector ? { name: topSector.name, pct: topSector.pct } : null}
      />

      <TopHoldings positions={snapshot.positions} ppmData={ppmData} />

      <PortfolioChartWidget snapshots={allSnapshots} />
    </main>
  );
}
