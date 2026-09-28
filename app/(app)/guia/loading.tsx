import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";

export default function GuiaLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Guía Cocos" description="Cómo descargar CSV desde Cocos Capital" />
      <main className="flex-1 px-6 py-10 max-w-5xl w-full mx-auto flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    </div>
  );
}
