import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { ConcentrationCharts } from "@/components/analysis/concentration-charts";
import { getConcentrationData } from "@/lib/analysis-data";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Análisis de concentración" };

export default async function AnalysisPage() {
  const data = await getConcentrationData();

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Análisis"
        description="Concentración por sector, país e industria"
      />

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8 max-w-6xl w-full mx-auto">
        {data ? (
          <>
            <div className="animate-fade-up flex flex-col gap-1">
              <p className="text-[9px] sm:text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                Distribución del portfolio
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed">
                Análisis de concentración basado en el snapshot más reciente.
                Asegurate de completar sector, país e industria en la página de Assets.
              </p>
            </div>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-6 animate-fade-up">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 sm:mb-5">
                  Concentración por sector y país
                </h3>
                <ConcentrationCharts data={data} />
              </div>

              <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-6 animate-fade-up">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">
                  Top 10 posiciones
                </h3>
                <div className="flex flex-col gap-2">
                  {data.bySector.map((item) => (
                    <div key={item.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-xs font-medium text-foreground">{item.name}</span>
                        <span className="text-[10px] sm:text-xs font-mono text-muted-foreground">
                          {item.pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1 sm:h-1.5 bg-muted rounded-full overflow-hidden">
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
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="size-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Sin datos de portfolio</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Importá al menos un snapshot desde el dashboard para ver el análisis de
                concentración.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
