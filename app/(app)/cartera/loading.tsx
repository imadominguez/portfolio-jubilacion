import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_MAIN } from "@/components/layout/page-parts";
import { CarteraSkeleton } from "@/components/dashboard/cartera-skeleton";

export default function CarteraLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Cartera" description="Tus posiciones, su costo y su peso" />
      <main className={PAGE_MAIN}>
        <Skeleton className="h-4 w-full max-w-xl" />
        <CarteraSkeleton />
      </main>
    </div>
  );
}
