import { Skeleton } from "@/components/ui/skeleton";

// Fallback del contenido de Historial CCL (loading.tsx y el <Suspense> de la página).
export function CclSkeleton() {
  return (
    <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </section>
      <Skeleton className="h-px w-full opacity-30" />
      <Skeleton className="h-[400px] rounded-xl" />
      <Skeleton className="h-px w-full opacity-30" />
      <Skeleton className="h-64 rounded-xl" />
    </main>
  );
}
