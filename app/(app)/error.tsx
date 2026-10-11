"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";

// En producción Next reemplaza el mensaje de los errores de servidor por un
// texto genérico en inglés: se muestra un mensaje propio con qué hacer y el
// código (digest) para buscarlo en los logs. El detalle va solo en desarrollo.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const showDetail = process.env.NODE_ENV !== "production" && error.message;

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Error" description="No se pudo cargar la sección" />
      <main className="flex-1 px-6 py-10 flex items-center justify-center">
        <div
          role="alert"
          className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-8 py-10 text-center animate-fade-up"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold text-foreground">No pudimos cargar esta sección</h2>
            <p className="text-sm text-muted-foreground">
              Suele ser algo pasajero: la base de datos o una API externa tardó en responder. Reintentá en unos
              segundos; tus datos no se modificaron.
            </p>
            {showDetail && <p className="mt-1 font-mono text-xs text-muted-foreground">{error.message}</p>}
            {error.digest && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">Código: {error.digest}</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>Reintentar</Button>
            <Button asChild variant="outline">
              <Link href="/">Ir al Dashboard</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
