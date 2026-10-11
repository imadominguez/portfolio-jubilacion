import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { PAGE_MAIN, PageIntro } from "@/components/layout/page-parts";
import { HoldingsTable } from "@/components/dashboard/holdings-table";
import { AllocationPanel } from "@/components/dashboard/allocation-panel";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { CarteraSkeleton } from "@/components/dashboard/cartera-skeleton";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { getLatestSnapshot } from "@/lib/portfolio-data";
import { calculatePPM } from "@/app/actions/transactions";
import { getMarketPrices } from "@/app/actions/market-prices";
import { formatDateMedium } from "@/lib/format";

export const metadata: Metadata = { title: "Cartera" };

// La tenencia completa: antes era el bloque más grande del Dashboard. El header
// y la bajada entran al static shell; los datos se streamean detrás del skeleton.
export default function CarteraPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Cartera" description="Tus posiciones, su costo y su peso" actions={<ImportButton />} />
      <main className={PAGE_MAIN}>
        <PageIntro>
          Lo que tenías en Cocos en el último snapshot, con el precio promedio de compra (PPM) de cada posición y su
          valor en dólares con los precios del día.
        </PageIntro>
        <Suspense fallback={<CarteraSkeleton />}>
          <CarteraContent />
        </Suspense>
      </main>
    </div>
  );
}

async function CarteraContent() {
  const [snapshot, ppmData, marketPrices] = await Promise.all([
    getLatestSnapshot(),
    calculatePPM(),
    getMarketPrices(),
  ]);

  if (!snapshot) return <EmptyDashboard />;

  return (
    <>
      <p className="-mt-4 text-sm text-muted-foreground">Snapshot del {formatDateMedium(snapshot.snapshotDate)}</p>
      <section className="grid gap-8 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <HoldingsTable positions={snapshot.positions} ppmData={ppmData} marketPrices={marketPrices} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <AllocationPanel positions={snapshot.positions} totalArs={snapshot.totalValueArs} />
        </div>
      </section>
    </>
  );
}
