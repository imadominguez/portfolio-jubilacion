import { Skeleton } from "@/components/ui/skeleton";

// Fallback de la tabla de rebalanceo (loading.tsx y el <Suspense> de la página).
export function RebalanceSkeleton() {
  return <Skeleton className="h-[300px] rounded-xl" />;
}
