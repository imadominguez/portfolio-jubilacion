"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatARS, formatPct, formatUSD, formatUSDCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

type Currency = "ARS" | "USD";

// Rendimiento del año en curso, sin contar aportes (ADR-0019).
export type HeroYear = {
  year: number;
  ars: { pct: number | null; gain: number } | null;
  usd: { pct: number | null; gain: number } | null;
};

export type HeroRetirement = {
  retirementAge: number;
  projectedUsd: number;
  neededUsd: number;
  isOnTrack: boolean;
};

interface DashboardHeroProps {
  totalValueArs: number;
  totalValueUsd: number | null;
  snapshotDateLabel: string;
  // Días desde el snapshot; pasado un mes la foto deja de representar la cartera.
  snapshotAgeDays: number;
  snapshotAgeLabel: string;
  ccl: number | null;
  // La tenencia del snapshot con los precios del día; null si no hay precios.
  live: { valueArs: number; valueUsd: number; asOfLabel: string } | null;
  year: HeroYear | null;
  retirement: HeroRetirement | null;
}

const STALE_DAYS = 35;

function signed(pct: number): string {
  return formatPct(pct, { signed: true });
}

// Contesta primero "¿cuánto tengo?" y al lado "¿voy bien?": el año sin aportes
// y la meta de jubilación. Superficie plana, sin glow ni pulso (DESIGN.md §1).
export function DashboardHero({
  totalValueArs,
  totalValueUsd,
  snapshotDateLabel,
  snapshotAgeDays,
  snapshotAgeLabel,
  ccl,
  live,
  year,
  retirement,
}: DashboardHeroProps) {
  const [currency, setCurrency] = useState<Currency>("ARS");
  const hasUsd = totalValueUsd !== null;
  const fmt = currency === "ARS" ? formatARS : formatUSD;

  const value = currency === "ARS" ? totalValueArs : totalValueUsd;
  const liveValue = live ? (currency === "ARS" ? live.valueArs : live.valueUsd) : null;
  const liveChangePct = liveValue !== null && value ? (liveValue / value - 1) * 100 : null;
  const yearData = year ? (currency === "ARS" ? year.ars : year.usd) : null;
  const stale = snapshotAgeDays > STALE_DAYS;
  const retirementPct = retirement && retirement.neededUsd > 0
    ? Math.min(100, (retirement.projectedUsd / retirement.neededUsd) * 100)
    : null;

  return (
    <section
      aria-labelledby="hero-title"
      className="grid gap-8 rounded-2xl border border-border bg-card px-6 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 id="hero-title" className="text-sm font-medium text-muted-foreground">
            Valor del portfolio
          </h1>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={currency}
            onValueChange={(v) => v && setCurrency(v as Currency)}
            aria-label="Moneda"
          >
            <ToggleGroupItem value="ARS" className="px-3 font-mono text-xs">
              ARS
            </ToggleGroupItem>
            <ToggleGroupItem value="USD" disabled={!hasUsd} className="px-3 font-mono text-xs">
              USD
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <p className="font-mono text-4xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground sm:text-5xl">
          {value !== null ? fmt(value) : "—"}
        </p>

        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>
            Snapshot del {snapshotDateLabel}
            <span aria-hidden> · </span>
            <span className={cn(stale && "font-medium text-warning")}>
              {snapshotAgeLabel}
              {stale && ": importá uno nuevo para ver tu cartera actual"}
            </span>
            {ccl !== null && (
              <>
                <span aria-hidden> · </span>
                CCL <span className="font-mono tabular-nums text-foreground/80">{formatARS(ccl)}</span>
              </>
            )}
          </p>
          {liveValue !== null && live && (
            <p>
              Con precios del {live.asOfLabel}:{" "}
              <span className="font-mono tabular-nums text-foreground/80">{fmt(liveValue)}</span>
              {liveChangePct !== null && (
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    liveChangePct >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {" "}
                  ({signed(liveChangePct)})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 border-border lg:border-l lg:pl-10">
        {year && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Rendimiento {year.year}</p>
            {yearData?.pct != null ? (
              <>
                <p
                  className={cn(
                    "font-mono text-2xl font-semibold tabular-nums",
                    yearData.pct >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {signed(yearData.pct)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {yearData.gain >= 0 ? "+" : ""}
                  {fmt(yearData.gain)} sin contar aportes
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Hace falta un snapshot de fin del año pasado.</p>
            )}
          </div>
        )}

        {retirement && retirementPct !== null ? (
          <Link href="/retirement" className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">Jubilación a los {retirement.retirementAge}</p>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-sm text-foreground">
              <span className="font-mono font-semibold tabular-nums">{formatUSDCompact(retirement.projectedUsd)}</span>{" "}
              proyectados de{" "}
              <span className="font-mono tabular-nums">{formatUSDCompact(retirement.neededUsd)}</span>
            </p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Capital proyectado sobre el necesario"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(retirementPct)}
            >
              <div
                className={cn("h-full rounded-full", retirement.isOnTrack ? "bg-success" : "bg-warning")}
                style={{ width: `${retirementPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {retirement.isOnTrack
                ? "En camino: llegás a la meta con tu aporte actual."
                : `Con tu aporte actual llegás al ${formatPct(retirementPct, { decimals: 0 })} de la meta.`}
            </p>
          </Link>
        ) : (
          <Link
            href="/retirement"
            className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            Definí tu plan de retiro
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}
