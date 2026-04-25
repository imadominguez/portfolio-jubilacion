import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { MilestonesClient } from "@/components/settings/milestones-client";
import { getMilestones } from "@/app/actions/milestones";
import { getLatestSnapshot } from "@/lib/portfolio-data";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const [milestones, snapshot] = await Promise.all([
    getMilestones(),
    getLatestSnapshot(),
  ]);

  const currentPortfolioUsd = snapshot?.totalValueUsd ?? null;

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Configuración" description="Hitos y preferencias" />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-4xl w-full mx-auto">
        <section className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Hitos de portfolio
          </p>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Configurá hitos de valor en USD. Se verifican automáticamente al
            importar cada snapshot y se registra la fecha de alcance.
          </p>
        </section>

        <MilestonesClient
          initialMilestones={milestones}
          currentPortfolioUsd={currentPortfolioUsd}
        />
      </main>
    </div>
  );
}
