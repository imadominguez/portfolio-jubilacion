import { Skeleton } from "@/components/ui/skeleton";

// Fallback de /cartera (loading.tsx y el <Suspense> de la página): tabla de
// posiciones y panel de distribución.
export function CarteraSkeleton() {
  return (
    <section className="grid gap-8 lg:grid-cols-5">
      <div className="lg:col-span-3 flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-border/40 last:border-0 flex items-center gap-6">
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-12" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="hidden sm:block h-3 w-8" />
              <Skeleton className="hidden md:block h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2 flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <div className="rounded-2xl border border-border/60 p-5 flex flex-col gap-4">
          <Skeleton className="mx-auto size-40 rounded-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
