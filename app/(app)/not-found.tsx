import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="No encontrado" />
      <main className="flex-1 px-6 py-10 flex items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card px-8 py-10 text-center animate-fade-up">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileQuestion className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-foreground">
              No encontramos esa página
            </h2>
            <p className="text-sm text-muted-foreground">
              El recurso que buscás no existe o no tenés acceso.
            </p>
          </div>
          <Button asChild>
            <Link href="/">Volver al dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
