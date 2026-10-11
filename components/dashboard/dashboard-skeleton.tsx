import { Skeleton } from "@/components/ui/skeleton";

// Fallback del contenido del Dashboard (loading.tsx y el <Suspense> de la página).
// Repite la estructura real: hero, métricas, "Este mes", posiciones principales y gráfico.
export function DashboardSkeleton() {
  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
      {/* Hero */}
      <section className="grid gap-8 rounded-2xl border border-border/60 bg-card/50 px-6 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-12 w-72 max-w-full" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </div>
        <div className="flex flex-col gap-6 lg:border-l lg:border-border/60 lg:pl-10">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-7 w-32" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </section>

      {/* Métricas */}
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-card px-5 py-4">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Este mes */}
      <section className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 bg-card px-5 py-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </section>

      {/* Posiciones principales */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 border-b border-border/40 last:border-0 flex items-center justify-between gap-6">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
