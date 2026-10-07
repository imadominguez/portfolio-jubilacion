import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RealGainsSkeleton } from "@/components/real-gains/real-gains-skeleton";

export default function RealGainsLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Ganancia Real" description="Desglose en USD · CCL · Apreciación" />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-80" />
        </div>
        <RealGainsSkeleton />
      </main>
    </div>
  );
}
