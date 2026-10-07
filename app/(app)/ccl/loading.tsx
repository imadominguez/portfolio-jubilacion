import { SiteHeader } from "@/components/layout/site-header";
import { CclSkeleton } from "@/components/ccl/ccl-skeleton";

export default function CCLLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Historial CCL" description="Contado con Liquidación" />
      <CclSkeleton />
    </div>
  );
}
