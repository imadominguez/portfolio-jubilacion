import { Skeleton } from "@/components/ui/skeleton";

// Fallback del editor de estrategia (loading.tsx y el <Suspense> de la página).
export function StrategySkeleton() {
  return (
    <div className="mt-4 rounded-xl border border-border/40 bg-card/50 p-5 flex flex-col gap-3">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-9 w-32 rounded-lg" />
    </div>
  );
}
