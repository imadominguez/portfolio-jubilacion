import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background noise-bg">
      {/* Header skeleton */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-10">
        {/* Hero value skeleton */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-2.5 w-36" />
              <Skeleton className="h-14 w-80" />
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>

          {/* KPI strip skeleton */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/40 bg-card/50 px-4 py-3 flex flex-col gap-2"
              >
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </section>

        <Separator className="opacity-30" />

        {/* Main grid skeleton */}
        <section className="grid gap-8 lg:grid-cols-5">
          {/* Allocation panel skeleton */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <Skeleton className="h-2.5 w-20" />
            <div className="rounded-lg border border-border/50 p-5 flex flex-col gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-10" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-[3px] w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Holdings table skeleton */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <Skeleton className="h-2.5 w-16" />
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex gap-8">
                {["flex-1", "w-12", "w-20", "w-24", "w-12"].map((w, i) => (
                  <Skeleton key={i} className={`h-2 ${w}`} />
                ))}
              </div>
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="px-5 py-4 border-b border-border/30 last:border-0 flex items-center gap-8"
                >
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-12" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
