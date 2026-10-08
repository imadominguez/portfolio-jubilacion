import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertsSkeleton } from "@/components/alerts/alerts-skeleton";

export default function AlertsLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Alertas" description="Avisos por mail" />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-4xl w-full mx-auto">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <AlertsSkeleton />
      </main>
    </div>
  );
}
