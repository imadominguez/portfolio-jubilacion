import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";

export default function StrategyLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Estrategia" description="System prompt de la estrategia de inversión" />
      <main className="flex-1 px-6 py-8 max-w-4xl w-full mx-auto flex flex-col gap-4">
        <Skeleton className="h-2.5 w-36" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <div className="mt-4 rounded-xl border border-border/40 bg-card/50 p-5 flex flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </main>
    </div>
  );
}
