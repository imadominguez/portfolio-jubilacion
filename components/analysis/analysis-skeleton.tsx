import { Skeleton } from "@/components/ui/skeleton";

// Fallback del contenido de Análisis (loading.tsx y el <Suspense> de la página).
export function AnalysisSkeleton() {
  return (
    <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[440px] rounded-xl" />
        <Skeleton className="h-[440px] rounded-xl" />
      </div>
    </main>
  );
}
