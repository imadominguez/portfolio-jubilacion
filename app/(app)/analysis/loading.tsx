import { SiteHeader } from "@/components/layout/site-header";
import { AnalysisSkeleton } from "@/components/analysis/analysis-skeleton";

export default function AnalysisLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Análisis" description="Concentración por sector, país e industria" />
      <AnalysisSkeleton />
    </div>
  );
}
