import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { RebalanceClient } from "@/components/rebalance/rebalance-client";
import { RebalanceSkeleton } from "@/components/rebalance/rebalance-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { getRebalanceData, getTargetAllocations } from "@/app/actions/rebalance";
import { Scale } from "lucide-react";

export const metadata: Metadata = { title: "Rebalanceo" };

// El header y la explicación entran al static shell; la asignación real y los
// objetivos se leen en request time detrás del skeleton.
export default function RebalancePage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Rebalanceo"
        description="Asignación objetivo vs real"
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Gestión de asignación
          </p>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Configurá el porcentaje objetivo para cada CEDEAR y la app te indicará
            qué tickers necesitan compra o venta para llegar al balance deseado.
            Desviaciones menores a ±1% se consideran en rango.
          </p>
        </div>

        <Suspense fallback={<RebalanceSkeleton />}>
          <Rebalance />
        </Suspense>
      </main>
    </div>
  );
}

async function Rebalance() {
  const [rebalanceData, targets] = await Promise.all([
    getRebalanceData(),
    getTargetAllocations(),
  ]);

  if (rebalanceData.length === 0 && targets.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="Sin datos para rebalancear"
        description="Importá tu primer snapshot para que la app conozca tus posiciones. Después definí el porcentaje objetivo de cada ticker."
        action={<ImportButton />}
      />
    );
  }

  const totalPct = targets.reduce((sum, t) => sum + t.targetPct, 0);

  return (
    <RebalanceClient
      rebalanceData={rebalanceData}
      targets={targets}
      totalPct={totalPct}
    />
  );
}
