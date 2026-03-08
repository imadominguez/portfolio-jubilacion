import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/layout/site-header";

export default function SnapshotDetailLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Snapshot" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-10 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-36" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-12 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/40 bg-card/50 px-4 py-3 flex flex-col gap-2">
              <Skeleton className="h-2 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
        <Separator className="opacity-30" />
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Skeleton className="h-[360px] rounded-lg" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-[360px] rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  );
}
