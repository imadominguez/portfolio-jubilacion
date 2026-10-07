import { SiteHeader } from "@/components/layout/site-header";
import { PerformanceSkeleton } from "@/components/performance/performance-skeleton";

export default function PerformanceLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Performance" description="Historial del portfolio" />
      <PerformanceSkeleton />
    </div>
  );
}
