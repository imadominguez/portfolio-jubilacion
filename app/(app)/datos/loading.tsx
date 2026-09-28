import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/layout/site-header";

export default function DatosLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Centro de Datos" description="Importá y mantené actualizada tu información" />
      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-32" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/40 bg-card/50 p-5 flex flex-col gap-3"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="mt-2 h-9 w-32 rounded-lg" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
