import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { DcaPlannerClient } from "@/components/plan/dca-planner-client";
import { getLatestSnapshot } from "@/lib/portfolio-data";
import { getTargetAllocations } from "@/app/actions/rebalance";
import { getMarketPrices } from "@/app/actions/market-prices";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = { title: "Plan DCA" };

export default async function PlanPage() {
  const [snapshot, targets, marketPrices] = await Promise.all([
    getLatestSnapshot(),
    getTargetAllocations(),
    getMarketPrices(),
  ]);

  const marketPriceMap: Record<string, number> = {};
  for (const p of marketPrices) {
    if (p.underlyingTicker) marketPriceMap[p.underlyingTicker] = p.priceUsd;
  }

  const positions =
    snapshot?.positions.map((p) => ({
      ticker: p.ticker,
      currentPct: p.allocationPct,
      currentValue: p.positionValue,
      currentPrice: p.price,
    })) ?? [];

  const hasTargets = targets.length > 0;

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Plan DCA"
        description="Qué comprar este mes según tus objetivos"
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Aporte mensual
          </p>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Reparto determinista del aporte del mes priorizando las posiciones
            infraponderadas respecto a tus objetivos, sin sumar a las que ya los
            alcanzaron. No usa IA: es el mismo criterio del DCA, siempre disponible.
          </p>
        </div>

        {!snapshot ? (
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
        ) : !hasTargets ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center animate-fade-up">
            <Wallet className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Sin objetivos definidos</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Definí el peso objetivo por ticker en Rebalanceo para generar el plan.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/rebalance">Configurar objetivos</Link>
            </Button>
          </div>
        ) : (
          <DcaPlannerClient
            portfolioValueArs={snapshot.totalValueArs}
            ccl={snapshot.ccl}
            positions={positions}
            targets={targets.map((t) => ({ ticker: t.ticker, targetPct: t.targetPct }))}
            assets={marketPrices.map((p) => ({
              ticker: p.ticker,
              cedearRatio: p.cedearRatio,
              underlyingTicker: p.underlyingTicker,
            }))}
            marketPrices={marketPriceMap}
          />
        )}
      </main>
    </div>
  );
}
