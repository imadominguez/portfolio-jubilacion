import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";

export default function GuiaLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Guía Cocos" description="Cómo descargar CSV desde Cocos Capital" />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-10 max-w-5xl w-full mx-auto flex flex-col gap-8 sm:gap-10">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-80 max-w-full" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-[30rem] w-full rounded-2xl" />
      </main>
    </div>
  );
}
