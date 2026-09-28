"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="glass relative w-full max-w-sm space-y-6 rounded-2xl p-7 shadow-xl text-center animate-fade-up">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground">
            {error.message || "Ocurrió un error inesperado."}
          </p>
        </div>
        <Button onClick={reset} className="w-full">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
