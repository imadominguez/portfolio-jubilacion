import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { AssetsTableClient } from "@/components/assets/assets-table-client";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { CclUpdateButton } from "@/components/exchange-rate/ccl-update-button";
import { MarketPricesButton } from "@/components/market/market-prices-button";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Assets" };

export default async function AssetsPage() {
  const assets = await db.asset.findMany({
    orderBy: { ticker: "asc" },
    select: {
      id: true,
      ticker: true,
      instrumentName: true,
      cedearRatio: true,
      description: true,
      sector: true,
      industry: true,
      country: true,
      underlyingTicker: true,
    },
  });

  const serialized = assets.map((a) => ({
    id: a.id,
    ticker: a.ticker,
    instrumentName: a.instrumentName,
    cedearRatio: Number(a.cedearRatio),
    description: a.description,
    sector: a.sector,
    industry: a.industry,
    country: a.country,
    underlyingTicker: a.underlyingTicker,
  }));

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Assets"
        description="Catálogo de CEDEARs"
        actions={
          <div className="flex items-center gap-1.5">
            <CclUpdateButton />
            <MarketPricesButton />
            <ImportButton />
          </div>
        }
      />

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-4 sm:gap-6 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[9px] sm:text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Referencia de ratios y metadata
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed">
            El ratio CEDEAR indica cuántos certificados equivalen a una acción
            subyacente. Completá el ticker subyacente, sector y país para
            habilitar análisis de concentración y precios en tiempo real.
          </p>
        </div>

        <AssetsTableClient assets={serialized} />
      </main>
    </div>
  );
}
