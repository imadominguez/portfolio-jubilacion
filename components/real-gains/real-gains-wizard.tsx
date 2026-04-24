"use client";

import { useState } from "react";
import { RefreshCw, Database, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchHistoricalCCL } from "@/app/actions/exchange-rate";
import { fetchAndCacheStockHistory } from "@/app/actions/historical-prices";
import type { DataReadiness } from "@/lib/real-gains-data";

interface RealGainsWizardProps {
  readiness: DataReadiness;
}

export function RealGainsWizard({ readiness }: RealGainsWizardProps) {
  const [loadingCcl, setLoadingCcl] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [cclDone, setCclDone] = useState(false);
  const [stocksDone, setStocksDone] = useState(false);

  const hasCcl = readiness.hasCclHistory > 0 || cclDone;
  const hasStocks = readiness.hasStockHistory > 0 || stocksDone;

  async function handleLoadCcl() {
    if (!readiness.firstBuyDate) return;
    setLoadingCcl(true);
    try {
      const from = new Date(readiness.firstBuyDate);
      from.setDate(from.getDate() - 7);
      const result = await fetchHistoricalCCL(from, new Date());
      if (result.success) {
        toast.success(
          `CCL histórico cargado: ${result.saved} fechas nuevas${result.skipped > 0 ? `, ${result.skipped} ya existían` : ""}.`
        );
        setCclDone(true);
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoadingCcl(false);
    }
  }

  async function handleLoadStocks() {
    setLoadingStocks(true);
    try {
      const result = await fetchAndCacheStockHistory();
      if (result.success) {
        const totalSaved = result.results.reduce((s, r) => s + r.saved, 0);
        toast.success(
          `Precios históricos cargados: ${totalSaved} registros para ${result.results.length} tickers.`
        );
        setStocksDone(true);
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoadingStocks(false);
    }
  }

  const allDone = hasCcl && hasStocks;

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Datos históricos
        </p>
        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
          Actualizá el CCL histórico y los precios de acciones. Los datos se
          cargan desde tu primera compra hasta hoy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Paso 1: CCL histórico */}
        <div
          className={`rounded-xl border bg-card shadow-sm p-5 flex flex-col gap-4 transition-colors ${
            hasCcl ? "border-emerald-500/30" : "border-border"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Paso 1 — CCL histórico
                </span>
                {hasCcl && (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tipo de cambio CCL por fecha desde{" "}
                <span className="font-mono">argentinadatos.com</span>.{" "}
                {readiness.hasCclHistory > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {readiness.hasCclHistory} fechas ya cargadas.
                  </span>
                )}
              </p>
            </div>
            <Database className="size-5 text-muted-foreground/40 shrink-0 mt-0.5" />
          </div>

          {!readiness.firstBuyDate ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="size-3.5 shrink-0" />
              Necesitás registrar transacciones primero.
            </div>
          ) : (
            <button
              onClick={handleLoadCcl}
              disabled={loadingCcl}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all ${
                hasCcl
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                  : "bg-foreground text-background hover:opacity-80"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loadingCcl ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Database className="size-3.5" />
              )}
              {loadingCcl
                ? "Cargando..."
                : hasCcl
                  ? "Actualizar CCL histórico"
                  : "Cargar CCL histórico"}
            </button>
          )}
        </div>

        {/* Paso 2: Precios de acciones */}
        <div
          className={`rounded-xl border bg-card shadow-sm p-5 flex flex-col gap-4 transition-colors ${
            hasStocks ? "border-emerald-500/30" : "border-border"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Paso 2 — Precios de acciones
                </span>
                {hasStocks && (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Precios USD históricos de los subyacentes desde{" "}
                <span className="font-mono">Yahoo Finance</span>.{" "}
                {readiness.hasStockHistory > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {readiness.hasStockHistory} registros ya cargados.
                  </span>
                )}
              </p>
            </div>
            <TrendingUp className="size-5 text-muted-foreground/40 shrink-0 mt-0.5" />
          </div>

          <button
            onClick={handleLoadStocks}
            disabled={loadingStocks}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all ${
              hasStocks
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                : "bg-foreground text-background hover:opacity-80"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loadingStocks ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <TrendingUp className="size-3.5" />
            )}
            {loadingStocks
              ? "Cargando..."
              : hasStocks
                ? "Actualizar precios históricos"
                : "Cargar precios históricos"}
          </button>
        </div>
      </div>

      {allDone && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Datos cargados. Recargá la página para ver el análisis completo de ganancia real.
          </p>
        </div>
      )}
    </div>
  );
}
