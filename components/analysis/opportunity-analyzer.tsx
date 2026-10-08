"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Loader2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OpportunityReportDisplay } from "@/components/analysis/opportunity-report";
import { isOpportunityReport, type OpportunityReport } from "@/lib/opportunity-report";

// Último reporte en el navegador para volver a verlo sin regenerarlo (y pagarlo).
// Clave nueva: los reportes de asignaciones viejos quedan en el historial.
const STORAGE_KEY = "portfolio_reporte_oportunidades";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// Se lee el string crudo (estable entre renders); en el servidor no hay storage.
function readCachedRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseCached(raw: string | null): OpportunityReport | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isOpportunityReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s} s`;
}

export function OpportunityAnalyzer() {
  const cachedRaw = useSyncExternalStore(subscribeStorage, readCachedRaw, () => null);
  const cached = useMemo(() => parseCached(cachedRaw), [cachedRaw]);
  const [fresh, setFresh] = useState<OpportunityReport | null>(null);
  const reporte = fresh ?? cached;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  const handleAnalyze = async () => {
    setElapsed(0);
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/analyze-portfolio", { method: "POST", signal: controller.signal });
      const json: unknown = await res.json();
      if (!res.ok || !isOpportunityReport(json)) {
        const message = (json as { error?: string } | null)?.error;
        throw new Error(message || "Error al generar el reporte.");
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
      } catch {
        // Sin almacenamiento local el reporte igual se muestra y queda en el historial.
      }
      setFresh(json);
    } catch (e: unknown) {
      setError(controller.signal.aborted ? "Análisis cancelado." : e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Oportunidades de tu cartera</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Revisa el precio y las últimas noticias de cada acción de tu último snapshot y dice si es momento de comprar,
          mantener o vender.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handleAnalyze} disabled={loading} className="flex-1" size="lg">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analizando… {formatElapsed(elapsed)}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generar reporte
                </>
              )}
            </Button>
            {loading && (
              <Button onClick={() => abortRef.current?.abort()} variant="outline" size="lg">
                Cancelar
              </Button>
            )}
          </div>
          {loading && (
            <p className="text-center text-xs text-muted-foreground">
              Bajando precios y noticias de cada acción y analizándolas. Suele tardar menos de un minuto.
            </p>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg border border-destructive/30">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {reporte && <OpportunityReportDisplay reporte={reporte} />}
    </div>
  );
}
