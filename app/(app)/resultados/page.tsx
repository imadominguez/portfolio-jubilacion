import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PAGE_MAIN, PageIntro } from "@/components/layout/page-parts";
import { SiteHeader } from "@/components/layout/site-header";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { ResultsSkeleton } from "@/components/results/results-skeleton";
import { ResultsView } from "@/components/results/results-view";
import { getTickerResults } from "@/lib/ticker-results-data";
import { localDateParts } from "@/lib/local-date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Resultados" };

type ResultsSearchParams = Promise<{ anio?: string | string[] }>;

// El header y la bajada entran al static shell; el año (searchParams) y los
// datos del usuario se resuelven dentro del <Suspense>.
export default function ResultsPage({ searchParams }: { searchParams: ResultsSearchParams }) {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Resultados" description="Ganancia y pérdida del año por ticker, en pesos y dólares" />

      <main className={PAGE_MAIN}>
        <PageIntro>
          Cuánto ganaste o perdiste en el año con cada ticker: lo que realizaste vendiendo, lo que varió lo que seguís
          teniendo y los dividendos, con cada compra y venta detallada.
        </PageIntro>

        <Suspense fallback={<ResultsSkeleton />}>
          <ResultsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function ResultsContent({ searchParams }: { searchParams: ResultsSearchParams }) {
  const [{ anio }, data] = await Promise.all([searchParams, getTickerResults(), connection()]);

  // connection() difiere la hora al request: searchParams y la sesión (cacheada
  // con `use cache: private`) entran en el prefetch, donde la hora no se puede leer.
  const requested = Number(Array.isArray(anio) ? anio[0] : anio);
  const currentYear = localDateParts(new Date()).year;
  const year = data.years.includes(requested)
    ? requested
    : data.years.includes(currentYear)
      ? currentYear
      : (data.years[0] ?? null);
  const results = year !== null ? data.byYear[year] : undefined;

  if (year === null || !results) {
    return (
      <EmptyState
        icon={ChartColumn}
        title="Sin datos todavía"
        description="Importá un snapshot de tenencia y el CSV de movimientos de Cocos para ver los resultados."
        action={<ImportButton />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {data.years.length > 1 && (
        <nav aria-label="Año" className="flex flex-wrap gap-1.5">
          {data.years.map((y) => (
            <Button
              key={y}
              asChild
              size="sm"
              variant={y === year ? "default" : "outline"}
              className={cn("font-mono tabular-nums", y === year && "pointer-events-none")}
            >
              <Link href={`/resultados?anio=${y}`} aria-current={y === year ? "page" : undefined}>
                {y}
              </Link>
            </Button>
          ))}
        </nav>
      )}

      {/* key: <Activity> conserva el estado entre navegaciones; al cambiar de año
          se vuelve a elegir el primer ticker. */}
      <ResultsView key={year} results={results} />
    </div>
  );
}
