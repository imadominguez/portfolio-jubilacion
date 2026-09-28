import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function RootNotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <FileQuestion className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          La ruta que buscás no existe.
        </p>
      </div>
      <Link
        href="/"
        className="text-sm font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
