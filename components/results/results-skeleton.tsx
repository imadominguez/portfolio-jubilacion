import { Skeleton } from "@/components/ui/skeleton";

// Fallback de /resultados (loading.tsx y el <Suspense> de la página).
export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
