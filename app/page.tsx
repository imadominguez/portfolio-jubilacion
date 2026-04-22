import type { Metadata } from "next";
import { Separator } from "@/components/ui/separator";

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
  const [snapshot, ppmData, marketPrices, allSnapshots, totalDividendsUsd, milestones] =
    await Promise.all([
      getLatestSnapshot(),
      calculatePPM(),
      getMarketPrices(),
      getAllSnapshotPoints(),
      getTotalDividendsUsd(),
      getMilestones(),
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
