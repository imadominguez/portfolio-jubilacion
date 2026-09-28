import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";

export default function PlanLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Plan DCA" description="Qué comprar este mes según tus objetivos" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="rounded-xl border border-border/40 bg-card/50 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Skeleton className="h-16 w-56" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="rounded-xl border border-border/40 bg-card/50 p-4 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </main>
    </div>
  );
}
