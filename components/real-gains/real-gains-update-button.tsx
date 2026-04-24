"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fetchHistoricalCCL } from "@/app/actions/exchange-rate";
import { fetchAndCacheStockHistory } from "@/app/actions/historical-prices";

export function RealGainsUpdateButton() {
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    setLoading(true);
    try {
      const [cclResult, stockResult] = await Promise.all([
        fetchHistoricalCCL(new Date(2020, 0, 1), new Date()),
        fetchAndCacheStockHistory(),
      ]);

      const msgs: string[] = [];
      if (cclResult.success) msgs.push(`CCL: +${cclResult.saved} fechas`);
      if (stockResult.success) {
        const total = stockResult.results.reduce((s, r) => s + r.saved, 0);
        msgs.push(`Acciones: +${total} registros`);
      }

      if (msgs.length > 0) {
        toast.success(`Datos actualizados. ${msgs.join(" · ")}`);
      } else {
        toast.info("No hubo datos nuevos para agregar.");
      }
    } catch {
      toast.error("Error al actualizar los datos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleUpdate}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Actualizando..." : "Actualizar datos"}
    </button>
  );
}
