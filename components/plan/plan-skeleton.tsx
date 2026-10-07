import { Skeleton } from "@/components/ui/skeleton";

// Fallback del planificador DCA (loading.tsx y el <Suspense> de la página).
export function PlanSkeleton() {
  return (
    <>
      <div className="rounded-xl border border-border/40 bg-card/50 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-16 w-56" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="rounded-xl border border-border/40 bg-card/50 p-4 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </>
  );
}
