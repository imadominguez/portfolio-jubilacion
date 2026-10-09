import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { DcaPlannerClient } from "@/components/plan/dca-planner-client";
import { PlanSkeleton } from "@/components/plan/plan-skeleton";
import { getLatestSnapshot } from "@/lib/portfolio-data";
import { getMarketPrices } from "@/app/actions/market-prices";
import { getLatestSignals } from "@/app/actions/reports";

export const metadata: Metadata = { title: "Plan DCA" };

const DAY_MS = 24 * 60 * 60 * 1000;
// Pasado este plazo las señales del reporte pueden estar viejas.
const OLD_REPORT_DAYS = 45;

const reportDateLabel = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

// El header y la explicación entran al static shell; el snapshot, las señales
// y los precios se leen en request time detrás del skeleton.
export default function PlanPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Plan DCA" description="Qué comprar este mes según el reporte de oportunidades" />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Aporte mensual
          </p>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Reparte el aporte del mes según las señales del último reporte de oportunidades: más a las
            acciones marcadas &quot;compra&quot; con mayor confianza, nada a las marcadas &quot;venta&quot;. Sin
            pesos objetivo ni topes por acción.
          </p>
        </div>

        <Suspense fallback={<PlanSkeleton />}>
          <Planner />
        </Suspense>
      </main>
    </div>
  );
}

async function Planner() {
  const [snapshot, marketPrices, latest] = await Promise.all([
    getLatestSnapshot(),
    getMarketPrices(),
    getLatestSignals(),
    connection(),
  ]);

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center animate-fade-up">
        <Wallet className="size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Sin datos de portfolio</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Importá un snapshot desde el Dashboard para calcular el plan del mes.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/datos">Ir al Centro de Datos</Link>
        </Button>
      </div>
    );
  }

  const marketPriceMap: Record<string, number> = {};
  for (const p of marketPrices) {
    if (p.underlyingTicker) marketPriceMap[p.underlyingTicker] = p.priceUsd;
  }

  // Después de connection(): la hora no puede leerse durante el prerender.
  const now = new Date();
  const reportIsOld = latest !== null && now.getTime() - latest.createdAt.getTime() > OLD_REPORT_DAYS * DAY_MS;

  return (
    <DcaPlannerClient
      portfolioValueArs={snapshot.totalValueArs}
      ccl={snapshot.ccl}
      positions={snapshot.positions.map((p) => ({
        ticker: p.ticker,
        currentPct: p.allocationPct,
        currentValue: p.positionValue,
        currentPrice: p.price,
      }))}
      assets={marketPrices.map((p) => ({
        ticker: p.ticker,
        cedearRatio: p.cedearRatio,
        underlyingTicker: p.underlyingTicker,
      }))}
      marketPrices={marketPriceMap}
      signals={latest?.signals ?? null}
      reportDate={latest ? reportDateLabel.format(latest.createdAt) : null}
      reportIsOld={reportIsOld}
    />
  );
}
