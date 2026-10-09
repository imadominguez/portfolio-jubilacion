import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { AssetsTableClient } from "@/components/assets/assets-table-client";
import { AssetsQuickSetup } from "@/components/assets/assets-quick-setup";
import { AssetsSkeleton } from "@/components/assets/assets-skeleton";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { CclUpdateButton } from "@/components/exchange-rate/ccl-update-button";
import { MarketPricesButton } from "@/components/market/market-prices-button";
import { getSetupStatus } from "@/app/actions/setup";
import { getAssetCatalog } from "@/app/actions/assets";

export const metadata: Metadata = { title: "Assets" };

// El header (con sus acciones) y la explicación entran al static shell; el
// catálogo y los tickers pendientes se leen en request time detrás del skeleton.
export default function AssetsPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Assets"
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
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Referencia de ratios y metadata
          </p>
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

  return (
    <>
      <AssetsQuickSetup missingTickers={setup.missingAssetTickers} />
      <AssetsTableClient assets={assets} />
    </>
  );
}
