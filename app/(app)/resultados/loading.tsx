import { SiteHeader } from "@/components/layout/site-header";
import { PAGE_MAIN } from "@/components/layout/page-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultsSkeleton } from "@/components/results/results-skeleton";

export default function ResultsLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Resultados" description="Ganancia y pérdida del año por ticker, en pesos y dólares" />

      <main className={PAGE_MAIN}>
        <Skeleton className="h-4 w-96 max-w-full" />
        <ResultsSkeleton />
      </main>
    </div>
  );
}
