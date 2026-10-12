"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Loader2 } from "lucide-react";
import type { MyAssetStatus } from "@/app/actions/asset-requests";

// Mientras se buscan datos de activos nuevos se refresca sola: el proceso corre
// en segundo plano después del import y suele tardar menos de un minuto.
const POLL_MS = 15_000;

const list = (tickers: string[]) => tickers.join(", ");

export function PendingAssetsBanner({ status, isAdmin }: { status: MyAssetStatus; isAdmin: boolean }) {
  const router = useRouter();
  const searching = status.searching.length > 0;

  useEffect(() => {
    if (!searching) return;
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [searching, router]);

  if (!searching && status.waiting.length === 0) return null;

  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-3.5 text-sm">
      {searching && (
        <p className="flex items-start gap-2.5 text-muted-foreground">
          <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
          <span>
            Buscando los datos de <span className="font-mono text-foreground">{list(status.searching)}</span>. Hasta que
            estén, esas posiciones no tienen valor en dólares ni análisis.
          </span>
        </p>
      )}
      {status.waiting.length > 0 && (
        <p className="flex items-start gap-2.5 text-muted-foreground">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            <span className="font-mono text-foreground">{list(status.waiting)}</span>{" "}
            {status.waiting.length === 1 ? "espera" : "esperan"} que un administrador confirme sus datos.
            {isAdmin && (
              <>
                {" "}
                <Link href="/assets#pedidos" className="text-primary underline-offset-4 hover:underline">
                  Revisar en Activos
                </Link>
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
