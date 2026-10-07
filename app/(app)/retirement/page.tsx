import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { RetirementClient } from "@/components/retirement/retirement-client";
import { RetirementSkeleton } from "@/components/retirement/retirement-skeleton";
import { getRetirementSettings } from "@/app/actions/retirement";
import { getAllSnapshotPoints } from "@/lib/portfolio-data";
import { cagrPct } from "@/lib/snapshot-returns";

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
  const [settings, snapshots] = await Promise.all([
    getRetirementSettings(),
    getAllSnapshotPoints(),
  ]);

  const latestSnapshot = snapshots.at(-1);
  const currentPortfolioUsd = latestSnapshot?.totalValueUsd ?? null;

  let historicalCagr = 0;
  const usdSnapshots = snapshots.filter((s) => s.totalValueUsd && s.totalValueUsd > 0);
  if (usdSnapshots.length >= 2) {
    const first = usdSnapshots[0];
    const last = usdSnapshots[usdSnapshots.length - 1];
    const daysDiff =
      (new Date(last.snapshotDate).getTime() - new Date(first.snapshotDate).getTime()) /
      (1000 * 60 * 60 * 24);
    const yearsDiff = daysDiff / 365;
    historicalCagr = cagrPct(first.totalValueUsd!, last.totalValueUsd!, yearsDiff) ?? 0;
  }

  return (
    <RetirementClient
      initialSettings={settings}
      currentPortfolioUsd={currentPortfolioUsd}
      historicalCagr={historicalCagr}
    />
  );
}
