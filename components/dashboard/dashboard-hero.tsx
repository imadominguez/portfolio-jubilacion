"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface DashboardHeroProps {
  totalValueArs: number;
  totalValueUsd: number | null;
  snapshotDateFormatted: string;
  gainArs: number | null;
  gainPct: number | null;
}

export function DashboardHero({
  totalValueArs,
  totalValueUsd,
  snapshotDateFormatted,
  gainArs,
  gainPct,
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

  return (
    /* Dark hero card — always dark like the Material Dashboard info card */
    <div className="relative overflow-hidden rounded-xl bg-[oklch(0.185_0.008_75)] dark:bg-[oklch(0.085_0.006_240)] shadow-lg px-6 py-7 sm:px-8 sm:py-8">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, oklch(0.697 0.195 149) 0%, transparent 70%)",
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
                    ? "bg-white text-[oklch(0.185_0.008_75)] shadow-sm"
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
          <p className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white tabular-nums leading-none transition-all duration-150">
            {displayValue}
          </p>

          <div className="flex flex-col sm:items-end gap-2 pb-0.5">
            {/* Date indicator */}
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-white/50">
                {snapshotDateFormatted}
              </span>
            </div>

            {/* Gain badge */}
            {gainPct !== null && gainArs !== null && (
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold tabular-nums ${
                  isPositive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
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
