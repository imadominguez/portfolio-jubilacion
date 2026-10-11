import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { AnalysisSkeleton } from "@/components/analysis/analysis-skeleton";
import { ConcentrationCharts } from "@/components/analysis/concentration-charts";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { Button } from "@/components/ui/button";
import { getConcentrationData } from "@/lib/analysis-data";
import { getLatestSnapshot } from "@/lib/portfolio-data";
import { PAGE_MAIN, PageIntro } from "@/components/layout/page-parts";
import { formatPct } from "@/lib/format";
import { BarChart3 } from "lucide-react";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";

export const metadata: Metadata = { title: "Concentración" };

// El header entra al static shell; la concentración y el rol se leen en
// request time y se streamean detrás del skeleton.
export default function AnalysisPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Concentración"
        description="Peso por sector, país e industria"
      />
      <Suspense fallback={<AnalysisSkeleton />}>
        <AnalysisContent />
      </Suspense>
    </div>
  );
}

async function AnalysisContent() {
  const [data, session, snapshot] = await Promise.all([
    getConcentrationData(),
    getSession(),
    getLatestSnapshot(),
  ]);
  // Las 10 de mayor peso; antes esta tarjeta repetía los sectores.
  const topPositions = [...(snapshot?.positions ?? [])].sort((a, b) => b.allocationPct - a.allocationPct).slice(0, 10);
  const isAdmin = isAdminRole(session?.user.role);

  return (
    <main className={PAGE_MAIN}>
      {data ? (
        <>
          <PageIntro>
            Cuánto pesa cada sector, país e industria en el snapshot más reciente. Salen del catálogo de
            activos: lo que no tenga sector o país queda como &quot;Sin clasificar&quot;.
          </PageIntro>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-5">Por sector, país e industria</h2>
              <ConcentrationCharts data={data} />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">Las 10 posiciones con más peso</h2>
              <ol className="flex flex-col gap-3">
                {topPositions.map((pos) => (
                  <li key={pos.ticker} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-foreground">{pos.ticker}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatPct(pos.allocationPct, { decimals: 1 })}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-chart-1 rounded-full" style={{ width: `${Math.min(pos.allocationPct, 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="Sin datos de portfolio"
          description="Importá al menos un snapshot desde el dashboard para ver la concentración. Sector, país e industria salen del catálogo de activos."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ImportButton />
              {isAdmin && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/assets">Completar activos</Link>
                </Button>
              )}
            </div>
          }
        />
      )}
    </main>
  );
}
