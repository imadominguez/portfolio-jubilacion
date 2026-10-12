"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { applyRatioProposal, dismissRatioProposal, type RatioProposalRow } from "@/app/actions/asset-requests";
import { formatDateMedium } from "@/lib/format";

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 4 });
const isoDate = (d: Date) => new Date(d).toISOString().slice(0, 10);

// Ratios del catálogo que difieren del listado de BYMA (ADR-0027). Casi siempre
// un split: el PDF no dice desde cuándo rige, así que el admin pone la fecha.
export function RatioProposalsPanel({ proposals }: { proposals: RatioProposalRow[] }) {
  if (proposals.length === 0) return null;
  return (
    <section id="cambios-de-ratio" aria-labelledby="ratio-proposals-title" className="scroll-mt-20 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="ratio-proposals-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Scale aria-hidden className="size-4 text-muted-foreground" />
          Cambios de ratio en el listado de BYMA
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          BYMA publica un ratio distinto del que tiene el catálogo. Si es un split, indicá desde qué día rige: las compras
          anteriores se ajustan al nuevo ratio. Si el catálogo ya estaba mal, marcalo como corrección.
        </p>
      </div>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
        {proposals.map((p) => (
          <ProposalRow key={`${p.ticker}:${p.newRatio}`} proposal={p} />
        ))}
      </ul>
    </section>
  );
}

function ProposalRow({ proposal: p }: { proposal: RatioProposalRow }) {
  const router = useRouter();
  const [date, setDate] = useState(isoDate(p.listingVersion));
  const [correction, setCorrection] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dateId = `ratio-date-${p.ticker}`;
  const correctionId = `ratio-correction-${p.ticker}`;

  const run = (action: () => ReturnType<typeof applyRatioProposal>, ok: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm">
          <span className="font-mono font-bold text-foreground">{p.ticker}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{fmt(p.oldRatio)}</span>
          <ArrowRight aria-label="pasa a" className="size-3.5 text-muted-foreground" />
          <span className="font-mono font-semibold tabular-nums text-foreground">{fmt(p.newRatio)}</span>
        </p>
        <p className="text-xs text-muted-foreground">Según el listado del {formatDateMedium(p.listingVersion)}.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={dateId} className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Rige desde</span>
          <Input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={correction || isPending}
            className="h-8 w-40 font-mono text-xs"
          />
        </label>
        <label htmlFor={correctionId} className="flex h-8 items-center gap-2 text-xs text-muted-foreground">
          <Checkbox id={correctionId} checked={correction} onCheckedChange={(v) => setCorrection(v === true)} />
          Es una corrección
        </label>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          disabled={isPending}
          onClick={() => run(() => dismissRatioProposal(p.ticker, p.newRatio), `Se mantiene el ratio de ${p.ticker}.`)}
        >
          Descartar
        </Button>
        <Button
          size="sm"
          className="gap-1.5 text-xs"
          disabled={isPending || (!correction && !date)}
          onClick={() =>
            run(
              () => applyRatioProposal(p.ticker, p.newRatio, correction ? null : date),
              `Ratio de ${p.ticker} actualizado a ${fmt(p.newRatio)}.`
            )
          }
        >
          {isPending && <Loader2 aria-hidden className="size-3 animate-spin" />}
          Aplicar
        </Button>
      </div>
    </li>
  );
}
