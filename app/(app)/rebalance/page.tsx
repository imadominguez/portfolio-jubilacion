import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { RebalanceClient } from "@/components/rebalance/rebalance-client";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { getRebalanceData, getTargetAllocations } from "@/app/actions/rebalance";
import { Scale } from "lucide-react";

export const metadata: Metadata = { title: "Rebalanceo" };

export default async function RebalancePage() {
  const [rebalanceData, targets] = await Promise.all([
    getRebalanceData(),
    getTargetAllocations(),
  ]);

  const totalPct = targets.reduce((sum, t) => sum + t.targetPct, 0);

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

        {rebalanceData.length === 0 && targets.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="Sin datos para rebalancear"
            description="Importá tu primer snapshot para que la app conozca tus posiciones. Después definí el porcentaje objetivo de cada ticker."
            action={<ImportButton />}
          />
        ) : (
          <RebalanceClient
            rebalanceData={rebalanceData}
            targets={targets}
            totalPct={totalPct}
          />
        )}
      </main>
    </div>
  );
}
