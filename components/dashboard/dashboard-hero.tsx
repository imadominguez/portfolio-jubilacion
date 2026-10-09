"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatARS, formatUSD } from "@/lib/format";

interface DashboardHeroProps {
  totalValueArs: number;
  totalValueUsd: number | null;
  snapshotDateFormatted: string;
  gainArs: number | null;
  gainPct: number | null;
  // La tenencia del snapshot con los precios del día; null si no hay precios.
  live: { valueArs: number; valueUsd: number; asOfLabel: string } | null;
}

export function DashboardHero({
  totalValueArs,
  totalValueUsd,
  snapshotDateFormatted,
  gainArs,
  gainPct,
  live,
}: DashboardHeroProps) {
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");

  const isPositive = gainPct !== null ? gainPct >= 0 : true;
  const hasUsd = totalValueUsd !== null;

  const displayValue =
    currency === "ARS"
      ? formatARS(totalValueArs)
      : hasUsd
        ? formatUSD(totalValueUsd!)
        : "—";

  const liveValue = live ? (currency === "ARS" ? live.valueArs : hasUsd ? live.valueUsd : null) : null;
  const snapshotValue = currency === "ARS" ? totalValueArs : totalValueUsd;
  const liveChangePct =
    liveValue !== null && snapshotValue ? (liveValue / snapshotValue - 1) * 100 : null;

  return (
    /* Azure Tech hero — navy profundo con glow azul/cian (ver DESIGN.md) */
    <div className="hero-surface relative overflow-hidden rounded-xl shadow-lg px-6 py-7 sm:px-8 sm:py-8">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--accent) 60%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-5">
        {/* Label + toggle row */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold tracking-widest text-white/50 uppercase">
            Valor total del portfolio
          </span>

          {/* Segmented currency toggle */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
            {(["ARS", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                disabled={c === "USD" && !hasUsd}
                className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                  currency === c
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Big number + meta */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white tabular-nums leading-none transition-all duration-150">
              {displayValue}
            </p>
            {liveValue !== null && live && (
              <p className="text-xs text-white/60">
                Hoy, con precios del {live.asOfLabel}:{" "}
                <span className="font-mono font-semibold tabular-nums text-white">
                  {currency === "ARS" ? formatARS(liveValue) : formatUSD(liveValue)}
                </span>
                {liveChangePct !== null && (
                  <span className={`font-mono tabular-nums ${liveChangePct >= 0 ? "text-success" : "text-destructive"}`}>
                    {" "}
                    ({liveChangePct >= 0 ? "+" : ""}
                    {liveChangePct.toFixed(2)}% vs snapshot)
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:items-end gap-2 pb-0.5">
            {/* Date indicator */}
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-mono text-white/50">
                {snapshotDateFormatted}
              </span>
            </div>

            {/* Gain badge */}
            {gainPct !== null && gainArs !== null && (
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold tabular-nums ${
                  isPositive
                    ? "bg-success/20 text-success"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="size-3.5 shrink-0" />
                ) : (
                  <ArrowDownRight className="size-3.5 shrink-0" />
                )}
                {isPositive ? "+" : ""}
                {gainPct.toFixed(2)}%
                <span className="opacity-40 mx-0.5">·</span>
                {isPositive ? "+" : ""}
                {formatARS(gainArs)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
