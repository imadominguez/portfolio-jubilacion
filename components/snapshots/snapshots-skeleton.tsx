import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Fallback del contenido de Snapshots (loading.tsx y el <Suspense> de la página).
export function SnapshotsSkeleton() {
  return (
    <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-8 w-10" />
      </div>
      <Separator className="opacity-30" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-2.5 w-16" />
        <div className="rounded-lg border border-border/50 overflow-hidden divide-y divide-border/30">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="size-1.5 rounded-full" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1 items-end">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
