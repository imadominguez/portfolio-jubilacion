import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { RebalanceClient } from "@/components/rebalance/rebalance-client";
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

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-4 sm:gap-6 max-w-6xl w-full mx-auto">
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
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <Scale className="size-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Sin objetivos configurados</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Agregá la asignación objetivo para cada ticker de tu portfolio para
                ver las recomendaciones de rebalanceo.
              </p>
            </div>
          </div>
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
