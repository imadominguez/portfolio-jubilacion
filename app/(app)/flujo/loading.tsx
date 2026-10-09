import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CashFlowSkeleton } from "@/components/cash-flow/cash-flow-skeleton";

export default function CashFlowLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Flujo de caja" description="Depósitos, gastos y ahorro" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <CashFlowSkeleton />
      </main>
    </div>
  );
}
