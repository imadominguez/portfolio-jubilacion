"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Inbox, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  approveAssetRequest,
  dismissAssetRequest,
  retryAssetRequest,
  type AssetRequestRow,
} from "@/app/actions/asset-requests";
import { cn } from "@/lib/utils";

const POLL_MS = 15_000;

const STATUS: Record<AssetRequestRow["status"], { label: string; className: string }> = {
  PENDING: { label: "En cola", className: "text-muted-foreground" },
  RUNNING: { label: "Buscando datos", className: "text-primary border-primary/30" },
  NEEDS_REVIEW: { label: "Para revisar", className: "text-warning border-warning/30" },
  FAILED: { label: "Falló", className: "text-destructive border-destructive/30" },
  DONE: { label: "Listo", className: "text-success border-success/30" },
};

const KIND_LABEL = { CEDEAR: "CEDEAR", FCI: "FCI", OTHER: "Otro" } as const;

type Draft = { ratio: string; underlyingTicker: string; sector: string; country: string; industry: string };

function draftOf(row: AssetRequestRow): Draft {
  const p = row.proposal;
  return {
    ratio: p?.cedearRatio != null ? String(p.cedearRatio) : "",
    underlyingTicker: p?.underlyingTicker ?? "",
    sector: p?.sector ?? "",
    country: p?.country ?? "",
    industry: p?.industry ?? "",
  };
}

// Pedidos de alta que dejó el import de cualquier usuario (ADR-0025). El
// sistema propone los datos y explica cada control; el admin confirma.
export function AssetRequestsPanel({ requests }: { requests: AssetRequestRow[] }) {
  const router = useRouter();
  const busy = requests.some((r) => r.status === "PENDING" || r.status === "RUNNING");

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [busy, router]);

  if (requests.length === 0) return null;

  return (
    <section id="pedidos" aria-labelledby="asset-requests-title" className="scroll-mt-20 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="asset-requests-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Inbox aria-hidden className="size-4 text-muted-foreground" />
          Pedidos de activos nuevos
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Tickers que aparecieron en el snapshot de algún usuario y no están en el catálogo. Los datos salen del listado
          de BYMA y de Yahoo; revisalos y aprobá.
        </p>
      </div>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
        {requests.map((r) => (
          <RequestRow key={`${r.ticker}:${r.status}:${r.attempts}`} row={r} />
        ))}
      </ul>
    </section>
  );
}

function RequestRow({ row }: { row: AssetRequestRow }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftOf(row));
  const [isPending, startTransition] = useTransition();
  const status = STATUS[row.status];
  const resolved = row.status === "NEEDS_REVIEW" || row.status === "FAILED";
  const isCedear = (row.proposal?.kind ?? "CEDEAR") === "CEDEAR";

  const run = (action: () => Promise<{ success: true } | { success: false; error: string }>, ok: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  const approve = () => {
    const ratio = Number(draft.ratio.replace(",", "."));
    if (!(ratio > 0)) {
      toast.error("El ratio debe ser mayor a 0.");
      return;
    }
    run(
      () =>
        approveAssetRequest(row.ticker, {
          cedearRatio: ratio,
          underlyingTicker: draft.underlyingTicker,
          sector: draft.sector,
          country: draft.country,
          industry: draft.industry,
        }),
      `${row.ticker} dado de alta.`
    );
  };

  const field = (key: keyof Draft, label: string, placeholder: string, mono = false) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        placeholder={placeholder}
        disabled={!resolved || isPending}
        className={cn("h-8 text-xs", mono && "font-mono uppercase")}
      />
    </label>
  );

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-sm font-bold text-foreground">{row.ticker}</span>
        <Badge variant="outline" className={cn("gap-1 text-[10px] font-normal", status.className)}>
          {row.status === "RUNNING" && <Loader2 aria-hidden className="size-2.5 animate-spin motion-reduce:animate-none" />}
          {status.label}
        </Badge>
        {row.proposal && <span className="text-[11px] text-muted-foreground">{KIND_LABEL[row.proposal.kind]}</span>}
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">{row.instrumentName}</span>
      </div>

      {row.proposal && (
        <ul className="flex flex-col gap-1">
          {row.proposal.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs text-muted-foreground">
              {c.ok ? (
                <Check aria-label="Correcto" className="mt-0.5 size-3.5 shrink-0 text-success" />
              ) : (
                <X aria-label="Pendiente" className="mt-0.5 size-3.5 shrink-0 text-warning" />
              )}
              {c.detail}
            </li>
          ))}
        </ul>
      )}
      {row.status === "FAILED" && row.lastError && <p className="text-xs text-destructive">{row.lastError}</p>}

      {resolved && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {field("ratio", "Ratio *", "20", true)}
            {isCedear && (
              <>
                {field("underlyingTicker", "Subyacente", "AAPL", true)}
                {field("sector", "Sector", "Tecnología")}
                {field("country", "País", "Estados Unidos")}
                {field("industry", "Industria", "Software")}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              disabled={isPending}
              onClick={() => run(() => dismissAssetRequest(row.ticker), `Pedido de ${row.ticker} descartado.`)}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={isPending}
              onClick={() => run(() => retryAssetRequest(row.ticker), `Buscando de nuevo los datos de ${row.ticker}.`)}
            >
              Buscar de nuevo
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" disabled={isPending} onClick={approve}>
              {isPending && <Loader2 aria-hidden className="size-3 animate-spin" />}
              Aprobar y dar de alta
            </Button>
          </div>
        </>
      )}
    </li>
  );
}
