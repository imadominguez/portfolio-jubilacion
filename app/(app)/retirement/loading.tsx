import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function RetirementLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Jubilación" description="Calculadora y proyección de retiro" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[240px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </main>
    </div>
  );
}
