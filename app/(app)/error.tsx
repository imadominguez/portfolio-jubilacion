"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Error" description="No se pudo cargar la sección" />
      <main className="flex-1 px-6 py-10 flex items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-8 py-10 text-center animate-fade-up">
          <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-foreground">
              Algo salió mal
            </h2>
            <p className="text-sm text-muted-foreground">
              {error.message || "Ocurrió un error inesperado al cargar los datos."}
            </p>
          </div>
          <Button onClick={reset}>Reintentar</Button>
        </div>
      </main>
    </div>
  );
}
