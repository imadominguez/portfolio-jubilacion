import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";
import { AssetsSkeleton } from "@/components/assets/assets-skeleton";

export default function AssetsLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Assets" description="Catálogo de CEDEARs" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-3.5 w-96" />
        </div>
        <AssetsSkeleton />
      </main>
    </div>
  );
}
