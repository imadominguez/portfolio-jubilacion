import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TaxReportSkeleton } from "@/components/taxes/tax-report-skeleton";

export default function TaxesLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Impuestos" description="Datos para Bienes Personales y Ganancias" />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <TaxReportSkeleton />
      </main>
    </div>
  );
}
