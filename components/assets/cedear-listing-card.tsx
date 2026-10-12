"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshCedearListing } from "@/app/actions/assets";
import { formatDateMedium } from "@/lib/format";

// Estado del listado oficial de BYMA (ADR-0024). El cron lo revisa cada 7 días;
// el botón fuerza la descarga, por ejemplo después de un cambio de ratio.
export function CedearListingCard({
  version,
  fetchedAt,
  rowCount,
}: {
  version: Date | null;
  fetchedAt: Date | null;
  rowCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(async () => {
      const result = await refreshCedearListing();
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section
      aria-labelledby="cedear-listing-title"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="cedear-listing-title" className="text-sm font-semibold text-foreground">
            Listado oficial de CEDEARs de BYMA
          </h2>
          <p className="text-xs text-muted-foreground">
            {version && fetchedAt
              ? `Versión del ${formatDateMedium(version)} · ${rowCount} CEDEARs · revisado el ${formatDateMedium(fetchedAt)}. De acá salen los ratios que se precargan.`
              : "Todavía no se bajó. Actualizalo para precargar los ratios oficiales al dar de alta un activo."}
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleRefresh} disabled={isPending}>
        <RefreshCw aria-hidden className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Bajando listado…" : "Actualizar listado"}
      </Button>
    </section>
  );
}
