import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { AssetsTableClient } from "@/components/assets/assets-table-client";
import { AssetsQuickSetup } from "@/components/assets/assets-quick-setup";
import { AssetsSkeleton } from "@/components/assets/assets-skeleton";
import { CedearListingCard } from "@/components/assets/cedear-listing-card";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { CclUpdateButton } from "@/components/exchange-rate/ccl-update-button";
import { MarketPricesButton } from "@/components/market/market-prices-button";
import { getSetupStatus } from "@/app/actions/setup";
import { getAssetCatalog, getCedearListingInfo } from "@/app/actions/assets";

export const metadata: Metadata = { title: "Activos" };

// El header (con sus acciones) y la explicación entran al static shell; el
// catálogo y los tickers pendientes se leen en request time detrás del skeleton.
export default function AssetsPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Activos"
        description="Catálogo de CEDEARs"
        actions={
          <div className="flex items-center gap-1.5">
            <CclUpdateButton compact />
            <MarketPricesButton compact />
            <ImportButton />
          </div>
        }
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            El ratio CEDEAR indica cuántos certificados equivalen a una acción
            subyacente. Completá el ticker subyacente, sector y país para
            habilitar análisis de concentración y precios en tiempo real.
          </p>
        </div>

        <Suspense fallback={<AssetsSkeleton />}>
          <AssetsCatalog />
        </Suspense>
      </main>
    </div>
  );
}

async function AssetsCatalog() {
  const [assets, setup] = await Promise.all([getAssetCatalog(), getSetupStatus()]);
  const listing = await getCedearListingInfo(setup.missingAssetTickers);

  return (
    <>
      <CedearListingCard version={listing.version} fetchedAt={listing.fetchedAt} rowCount={listing.rowCount} />
      {/* key: con <Activity> el estado sobrevive a la navegación; con otros
          tickers o un listado nuevo, los borradores arrancan de nuevo. */}
      <AssetsQuickSetup
        key={`${setup.missingAssetTickers.join(",")}:${listing.version?.getTime() ?? 0}`}
        missingTickers={setup.missingAssetTickers}
        listing={listing.entries}
      />
      <AssetsTableClient assets={assets} />
    </>
  );
}
