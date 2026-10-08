import { Skeleton } from "@/components/ui/skeleton";

// Fallback de /alertas (loading.tsx y el <Suspense> de la página).
export function AlertsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-5">
        <Skeleton className="h-5 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}
