import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";

export default function CCLLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Historial CCL" description="Contado con Liquidación" />
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
    </div>
  );
}
