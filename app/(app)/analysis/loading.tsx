import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalysisLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Análisis" description="Concentración por sector, país e industria" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[440px] rounded-xl" />
          <Skeleton className="h-[440px] rounded-xl" />
        </div>
      </main>
    </div>
  );
}
