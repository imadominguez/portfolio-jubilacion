import { Skeleton } from "@/components/ui/skeleton";

// Fallback de /flujo (loading.tsx y el <Suspense> de la página).
export function CashFlowSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
