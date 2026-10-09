import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { SiteHeader } from "@/components/layout/site-header";
import { RetirementClient } from "@/components/retirement/retirement-client";
import { RetirementSkeleton } from "@/components/retirement/retirement-skeleton";
import { getRetirementSettings } from "@/app/actions/retirement";
import { getAllSnapshotPoints, getContributionStats, getHoldingsFlows } from "@/lib/portfolio-data";
import { localDateParts, monthKeyOf, shiftMonth } from "@/lib/local-date";
import { holdingsXirr } from "@/lib/flow-returns";

export const metadata: Metadata = { title: "Planificación de jubilación" };

// El header y la explicación entran al static shell; la configuración y los
// snapshots del usuario se leen en request time y se streamean detrás del skeleton.
export default function RetirementPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Jubilación"
        description="Calculadora y proyección de retiro"
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Planificación de retiro
          </p>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Calculá cuánto capital necesitás acumular para jubilarte y proyectá
            si tu portfolio actual está en camino de alcanzar esa meta.
          </p>
        </div>

        <Suspense fallback={<RetirementSkeleton />}>
          <Retirement />
        </Suspense>
      </main>
    </div>
  );
}

async function Retirement() {
  await connection();
  // Últimos 12 meses cerrados, en hora de Argentina (después de connection():
  // la hora no puede leerse durante el prerender).
  const currentMonth = monthKeyOf(localDateParts(new Date()));
  const [settings, snapshots, flows, contributions] = await Promise.all([
    getRetirementSettings(),
    getAllSnapshotPoints(),
    getHoldingsFlows(),
    getContributionStats(shiftMonth(currentMonth, -12), shiftMonth(currentMonth, -1)),
  ]);

  const latestSnapshot = snapshots.at(-1);
  const currentPortfolioUsd = latestSnapshot?.totalValueUsd ?? null;

  let historicalCagr = 0;
  const usdSnapshots = snapshots.filter((s) => s.totalValueUsd && s.totalValueUsd > 0);
  if (usdSnapshots.length >= 2) {
    const first = usdSnapshots[0];
    const last = usdSnapshots[usdSnapshots.length - 1];
    const yearsDiff =
      (last.snapshotDate.getTime() - first.snapshotDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    // TIR en USD: el crecimiento del valor incluye los aportes y sobreestimaría
    // el rendimiento proyectado (ADR-0019). Con menos de ~1 mes, anualizar no informa.
    if (yearsDiff >= 0.1) {
      const points = usdSnapshots.map((s) => ({ date: s.snapshotDate, value: s.totalValueUsd! }));
      historicalCagr = holdingsXirr(points, flows.flowsUsd) ?? 0;
    }
  }

  return (
    <RetirementClient
      initialSettings={settings}
      currentPortfolioUsd={currentPortfolioUsd}
      historicalCagr={historicalCagr}
      realContribution={flows.lastMovementDate ? contributions : null}
    />
  );
}
