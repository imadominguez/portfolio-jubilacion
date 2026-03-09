import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { RetirementClient } from "@/components/retirement/retirement-client";
import { getRetirementSettings } from "@/app/actions/retirement";
import { getAllSnapshotPoints } from "@/lib/portfolio-data";

export const metadata: Metadata = { title: "Planificación de jubilación" };

function calcCAGR(first: number, last: number, years: number): number {
  if (years <= 0 || first <= 0) return 0;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

export default async function RetirementPage() {
  const [settings, snapshots] = await Promise.all([
    getRetirementSettings(),
    getAllSnapshotPoints(),
  ]);

  const latestSnapshot = snapshots.at(-1);
  const currentPortfolioUsd = latestSnapshot?.totalValueUsd ?? null;

  let historicalCagr = 0;
  if (snapshots.length >= 2) {
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const daysDiff =
      (new Date(last.snapshotDate).getTime() - new Date(first.snapshotDate).getTime()) /
      (1000 * 60 * 60 * 24);
    const yearsDiff = daysDiff / 365;
    historicalCagr = calcCAGR(first.totalValueArs, last.totalValueArs, yearsDiff);
  }

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

        <RetirementClient
          initialSettings={settings}
          currentPortfolioUsd={currentPortfolioUsd}
          historicalCagr={historicalCagr}
        />
      </main>
    </div>
  );
}
