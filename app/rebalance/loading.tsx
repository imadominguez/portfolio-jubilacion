import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function RebalanceLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Rebalanceo" description="Asignación objetivo vs real" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[300px] rounded-xl" />
      </main>
    </div>
  );
}
