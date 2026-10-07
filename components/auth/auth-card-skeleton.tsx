import { Skeleton } from "@/components/ui/skeleton";

// Fallback de login y registro: el formulario depende de datos de request
// (searchParams, ALLOW_PUBLIC_SIGNUP), así que el static shell muestra el mismo
// fondo y tarjeta en vez de una pantalla vacía.
export function AuthCardSkeleton() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />
      <div className="glass relative w-full max-w-sm space-y-7 rounded-2xl p-7 shadow-xl">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-12 rounded-xl" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-60" />
        </div>
        <div className="space-y-4">
          {[0, 1].map((field) => (
            <div key={field} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
