import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { ConcentrationCharts } from "@/components/analysis/concentration-charts";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { Button } from "@/components/ui/button";
import { getConcentrationData } from "@/lib/analysis-data";
import { BarChart3 } from "lucide-react";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";

export const metadata: Metadata = { title: "Análisis de concentración" };

export default async function AnalysisPage() {
  const [data, session] = await Promise.all([
    getConcentrationData(),
    getSession(),
  ]);
  const isAdmin = isAdminRole(session?.user.role);

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Análisis"
        description="Concentración por sector, país e industria"
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6  w-full mx-auto">
        {data ? (
          <>
            <div className="animate-fade-up flex flex-col gap-1">
              <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                Distribución del portfolio
              </p>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                Análisis de concentración basado en el snapshot más reciente.
                Asegurate de completar sector, país e industria en la página de Assets.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card shadow-sm p-6 animate-fade-up">
                <h3 className="text-sm font-semibold text-foreground mb-5">
                  Concentración por sector y país
                </h3>
                <ConcentrationCharts data={data} />
              </div>

              <div className="rounded-xl border border-border bg-card shadow-sm p-6 animate-fade-up">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Top 10 posiciones
                </h3>
                <div className="flex flex-col gap-2">
                  {data.bySector.map((item) => (
                    <div key={item.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">{item.name}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-chart-1 rounded-full"
                          style={{ width: `${Math.min(item.pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="Sin datos de portfolio"
            description="Importá al menos un snapshot desde el dashboard para ver el análisis de concentración. Sector, país e industria salen del catálogo de Assets."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ImportButton />
                {isAdmin && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/assets">Completar Assets</Link>
                  </Button>
                )}
              </div>
            }
          />
        )}
      </main>
    </div>
  );
}
