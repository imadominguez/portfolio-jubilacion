import { Skeleton } from "@/components/ui/skeleton";

// Fallback del catálogo de assets (loading.tsx y el <Suspense> de la página).
export function AssetsSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex gap-8">
          {["w-12", "flex-1", "w-16", "w-32", "w-16"].map((w, i) => (
            <Skeleton key={i} className={`h-2 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-border/30 last:border-0 flex items-center gap-8">
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-28" />
            <div className="flex gap-1">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
