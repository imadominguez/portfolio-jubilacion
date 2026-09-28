import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <main className="flex flex-col gap-8 px-6 py-10 max-w-5xl w-full mx-auto">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-3 w-full max-w-lg" />
      </div>
      <div className="rounded-xl border border-border/40 bg-card/50 p-6 flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
