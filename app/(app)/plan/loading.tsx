import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";
import { PlanSkeleton } from "@/components/plan/plan-skeleton";

export default function PlanLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Plan DCA" description="Qué comprar este mes según tus objetivos" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <PlanSkeleton />
      </main>
    </div>
  );
}
