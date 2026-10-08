import { Skeleton } from "@/components/ui/skeleton";

// Fallback del reporte (loading.tsx y el <Suspense> de la página).
export function TaxReportSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-96 max-w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
