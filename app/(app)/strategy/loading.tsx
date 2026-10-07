import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";
import { StrategySkeleton } from "@/components/strategy/strategy-skeleton";

export default function StrategyLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Estrategia" description="System prompt de la estrategia de inversión" />
      <main className="flex-1 px-6 py-8 max-w-4xl w-full mx-auto flex flex-col gap-4">
        <Skeleton className="h-2.5 w-36" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <StrategySkeleton />
      </main>
    </div>
  );
}
