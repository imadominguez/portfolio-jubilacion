"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { createAsset } from "@/app/actions/assets";

type DraftRow = {
  ratio: string;
  underlyingTicker: string;
  sector: string;
  country: string;
  industry: string;
};

type AssetsQuickSetupProps = {
  missingTickers: string[];
};

function emptyDraft(ticker: string): DraftRow {
  return {
    ratio: "",
    // La mayoría de los CEDEARs comparten ticker con el subyacente.
    underlyingTicker: ticker,
    sector: "",
    country: "",
    industry: "",
  };
}

export function AssetsQuickSetup({ missingTickers }: AssetsQuickSetupProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>(() =>
    Object.fromEntries(missingTickers.map((t) => [t, emptyDraft(t)]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (missingTickers.length === 0) return null;

  function update(ticker: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => ({ ...prev, [ticker]: { ...prev[ticker], ...patch } }));
  }

  function handleSave() {
    setErrors({});
    const invalid: Record<string, string> = {};
    for (const ticker of missingTickers) {
      const ratio = Number(drafts[ticker].ratio);
      if (!Number.isFinite(ratio) || ratio <= 0) {
        invalid[ticker] = "El ratio debe ser mayor a 0.";
      }
    }
    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      return;
    }

    startTransition(async () => {
      const results = await Promise.allSettled(
        missingTickers.map((ticker) => {
          const d = drafts[ticker];
          return createAsset({
            ticker,
            cedearRatio: Number(d.ratio),
            underlyingTicker: d.underlyingTicker.trim() || undefined,
            sector: d.sector.trim() || undefined,
            country: d.country.trim() || undefined,
            industry: d.industry.trim() || undefined,
          });
        })
      );

      const failed: Record<string, string> = {};
      results.forEach((result, i) => {
        const ticker = missingTickers[i];
        if (
          result.status === "rejected" ||
          (result.value && result.value.success === false)
        ) {
          failed[ticker] =
            result.status === "fulfilled" && result.value.success === false
              ? result.value.error
              : "No se pudo guardar.";
        }
      });

      if (Object.keys(failed).length === 0) {
        toast.success(
          missingTickers.length === 1
            ? "Activo guardado."
            : `${missingTickers.length} activos guardados.`
        );
        router.refresh();
      } else {
        setErrors(failed);
        const ok = missingTickers.length - Object.keys(failed).length;
        if (ok > 0) {
          toast.success(`${ok} activos guardados, ${Object.keys(failed).length} con error.`);
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] shadow-sm overflow-hidden animate-fade-up">
      <div className="px-5 py-4 border-b border-border/50 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">
            Completá tus activos detectados
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Detectamos {missingTickers.length}{" "}
            {missingTickers.length === 1 ? "ticker" : "tickers"} en tu snapshot sin
            datos completos. Completá el ratio (obligatorio) y, si podés, el
            subyacente, sector y país. Habilitan USD en vivo, Concentración y
            Ganancia Real.
          </p>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {missingTickers.map((ticker) => {
          const d = drafts[ticker];
          const error = errors[ticker];
          return (
            <div key={ticker} className="px-5 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Layers className="size-3.5 text-muted-foreground/50" />
                <span className="text-sm font-bold font-mono text-foreground">
                  {ticker}
                </span>
                {error && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal text-destructive border-destructive/30 gap-1"
                  >
                    <AlertCircle className="size-2.5" />
                    {error}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Ratio *
                  </span>
                  <Input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={d.ratio}
                    onChange={(e) => update(ticker, { ratio: e.target.value })}
                    placeholder="10"
                    className="h-8 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Subyacente
                  </span>
                  <Input
                    value={d.underlyingTicker}
                    onChange={(e) =>
                      update(ticker, { underlyingTicker: e.target.value })
                    }
                    placeholder="AAPL"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Sector
                  </span>
                  <Input
                    value={d.sector}
                    onChange={(e) => update(ticker, { sector: e.target.value })}
                    placeholder="Technology"
                    className="h-8 text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    País
                  </span>
                  <Input
                    value={d.country}
                    onChange={(e) => update(ticker, { country: e.target.value })}
                    placeholder="USA"
                    className="h-8 text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Industria
                  </span>
                  <Input
                    value={d.industry}
                    onChange={(e) => update(ticker, { industry: e.target.value })}
                    placeholder="Consumer Electronics"
                    className="h-8 text-xs"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-4 border-t border-border/50 flex items-center justify-between gap-3 bg-muted/10">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-emerald-500" />
          Sólo el ratio es obligatorio
        </span>
        <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-2">
          {isPending && <Spinner className="size-3" />}
          Guardar {missingTickers.length}{" "}
          {missingTickers.length === 1 ? "activo" : "activos"}
        </Button>
      </div>
    </div>
  );
}
