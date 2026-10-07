import { Skeleton } from "@/components/ui/skeleton";

// Fallback de las pestañas de transacciones (loading.tsx y el <Suspense> de la página).
export function TransactionsSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-96 max-w-full" />
      <Skeleton className="h-[300px] rounded-xl" />
    </>
  );
}
