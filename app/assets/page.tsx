import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { AssetsTableClient } from "@/components/assets/assets-table-client";
import { ImportButton } from "@/components/snapshots/snapshots-client";
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
    },
  });

  const serialized = assets.map((a) => ({
    id: a.id,
    ticker: a.ticker,
    instrumentName: a.instrumentName,
    cedearRatio: Number(a.cedearRatio),
    description: a.description,
  }));

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Assets" description="Catálogo de CEDEARs" actions={<ImportButton />} />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Referencia de ratios
          </p>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            El ratio CEDEAR indica cuántos certificados equivalen a una acción
            subyacente. Se usa para calcular el precio implícito en USD de cada posición.
          </p>
        </div>

        <AssetsTableClient assets={serialized} />
      </main>
    </div>
  );
}
