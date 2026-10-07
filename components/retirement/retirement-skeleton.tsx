import { Skeleton } from "@/components/ui/skeleton";

// Fallback de la calculadora de retiro (loading.tsx y el <Suspense> de la página).
export function RetirementSkeleton() {
  return (
    <>
      <Skeleton className="h-[240px] rounded-xl" />
      <Skeleton className="h-[400px] rounded-xl" />
    </>
  );
}
