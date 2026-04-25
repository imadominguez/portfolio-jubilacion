import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/layout/site-header";

export default function PerformanceLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Performance" description="Historial del portfolio" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-10 max-w-6xl w-full mx-auto">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/40 bg-card/50 px-4 py-3 flex flex-col gap-2"
            >
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          ))}
        </div>
        <Separator className="opacity-30" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-2.5 w-32" />
          <div className="rounded-lg border border-border/50 bg-card/30 p-5">
            <Skeleton className="h-[320px] w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
