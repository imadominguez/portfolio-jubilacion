"use client";

import { useState, useEffect, useTransition } from "react";
import { History, ChevronRight, Loader2, FileX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ReporteDisplay } from "@/components/analysis/portfolio-analizer";
import { listReports, getReport } from "@/app/actions/reports";
import type { ReportListItem } from "@/app/actions/reports";
import type { ReportePortafolio } from "@/components/analysis/portfolio-analizer";

export function ReportHistorial() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reporte, setReporte] = useState<ReportePortafolio | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listReports().then((r) => {
      setReports(r);
      setLoadingList(false);
    });
  }, []);

  const handleSelect = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setReporte(null);
    startTransition(async () => {
      const data = await getReport(id);
      setReporte(data);
    });
  };

  if (loadingList) {
    return (
      <div className="max-w-4xl mx-auto px-4 pb-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando historial…
      </div>
    );
  }

  if (reports.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-12 space-y-6">
      <Separator />

      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Historial de reportes</h2>
        <span className="text-xs text-muted-foreground ml-1">({reports.length})</span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            Seleccioná un reporte para verlo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reports.map((r, i) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50 ${
                selectedId === r.id ? "bg-primary/5 text-primary font-medium" : "text-foreground"
              } ${i < reports.length - 1 ? "border-b" : ""}`}
            >
              <span className="font-mono">{r.label}</span>
              <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedId === r.id ? "rotate-90 text-primary" : "text-muted-foreground"}`} />
            </button>
          ))}
        </CardContent>
      </Card>

      {selectedId && (
        <div className="space-y-6">
          {isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando reporte…
            </div>
          )}

          {!isPending && reporte === null && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <FileX className="w-8 h-8" />
              <p className="text-sm">No se pudo cargar el reporte seleccionado.</p>
            </div>
          )}

          {!isPending && reporte !== null && (
            <ReporteDisplay reporte={reporte} />
          )}
        </div>
      )}
    </div>
  );
}
