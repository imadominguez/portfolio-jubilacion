import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteHeader } from "@/components/layout/site-header";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { TaxReportSkeleton } from "@/components/taxes/tax-report-skeleton";
import { TaxReportView } from "@/components/taxes/tax-report-view";
import { buildTaxReport, getTaxData } from "@/lib/tax-report-data";
import { defaultTaxYear } from "@/lib/tax-report";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Impuestos" };

type TaxSearchParams = Promise<{ anio?: string | string[] }>;

// El header y la explicación entran al static shell; el año (searchParams) y
// los datos del usuario se resuelven dentro del <Suspense>.
export default function TaxesPage({ searchParams }: { searchParams: TaxSearchParams }) {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Impuestos" description="Datos para Bienes Personales y Ganancias" />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Declaración anual
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Lo que la app sabe de tu cuenta para la declaración de un año: la tenencia al cierre, las
            ventas con su resultado y los dividendos cobrados. Es información para vos o tu contador, no
            asesoramiento impositivo: exenciones, tipo de cambio y forma de declarar se definen aparte.
          </p>
        </div>

        <Suspense fallback={<TaxReportSkeleton />}>
          <TaxContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function TaxContent({ searchParams }: { searchParams: TaxSearchParams }) {
  const [{ anio }, data] = await Promise.all([searchParams, getTaxData(), connection()]);

  // connection() difiere la hora al request: searchParams y la sesión (cacheada
  // con `use cache: private`) entran en el prefetch, donde la hora no se puede leer.
  const requested = Number(Array.isArray(anio) ? anio[0] : anio);
  const year = data.years.includes(requested)
    ? requested
    : defaultTaxYear(data.years, new Date().getFullYear());

  if (year === null) {
    return (
      <EmptyState
        icon={Receipt}
        title="Sin datos todavía"
        description="Importá un snapshot de tenencia o el CSV de movimientos de Cocos para armar el reporte."
        action={<ImportButton />}
      />
    );
  }

  const report = buildTaxReport(data, year);

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Año" className="flex flex-wrap gap-1.5">
          {data.years.map((y) => (
            <Button
              key={y}
              asChild
              size="sm"
              variant={y === year ? "default" : "outline"}
              className={cn("font-mono tabular-nums", y === year && "pointer-events-none")}
            >
              <Link href={`/impuestos?anio=${y}`} aria-current={y === year ? "page" : undefined}>
                {y}
              </Link>
            </Button>
          ))}
        </nav>
        <Button asChild size="sm" variant="outline">
          <a href={`/api/export/impuestos?anio=${year}`} download>
            <Download className="size-3.5" />
            Descargar CSV {year}
          </a>
        </Button>
      </div>

      <TaxReportView report={report} />
    </div>
  );
}
