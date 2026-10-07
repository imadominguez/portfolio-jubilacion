import { Skeleton } from "@/components/ui/skeleton";

// Fallback de la lista de hitos (loading.tsx y el <Suspense> de la página).
export function MilestonesSkeleton() {
  return <Skeleton className="h-[300px] rounded-xl" />;
}
