"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, AlertTriangle, Info, Zap,
  Upload, FileText, DollarSign, Calendar, ArrowRight,
  Loader2, CheckCircle2, XCircle, MinusCircle, PlusCircle, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Posicion {
  ticker: string; nombre: string; sector: string;
  cantidad: number; precio_cedear_ars: number; valor_ars: number;
  peso_actual: number; peso_objetivo: number; diferencia: number;
  estado: "infrapon" | "sobrepon" | "ok" | "ausente" | "fuera_objetivo";
  ganancia_pct: number; ppm_ars: number;
  accion: "agregar" | "no_agregar" | "evaluar" | "mantener";
  sesgo_mes?: "sobreponderar" | "subponderar" | "neutral" | "saltear";
  variacion_mensual_pct?: number;
  nota?: string;
}

interface Asignacion {
  ticker: string;
  nombre: string;
  monto_ars: number;
  monto_usd: number;
  razon: string;
  peso_objetivo?: number;
  peso_asignado_mes?: number;
  sesgo?: "sobreponderar" | "subponderar" | "neutral" | "saltear";
}

interface Alerta {
  tipo: "critica" | "advertencia" | "oportunidad" | "info";
  ticker: string; titulo: string; detalle: string;
}

interface ProximoBalance {
  ticker: string;
  nombre: string;
  fecha: string;
  en_cartera: boolean;
  impacto_esperado?: string;
}
interface DividendoEsperado { ticker: string; nombre: string; monto_usd_por_accion: number; cantidad_cedears_por_accion: number; frecuencia: string; }

export interface ReportePortafolio {
  fecha_reporte: string;
  ccl_actual: number;
  valor_total_ars: number;
  valor_total_usd: number;
  aporte_mensual_ars: number;
  aporte_mensual_usd: number;
  resumen_ejecutivo: string;
  posiciones: Posicion[];
  instruccion_mes: {
    intro: string;
    asignaciones: Asignacion[];
    no_invertir: string[];
    total_ars: number;
    verificacion_suma?: boolean;
  };
  alertas: Alerta[];
  proximos_balances: ProximoBalance[];
  dividendos_esperados: DividendoEsperado[];
  /** Legacy: formato anterior con verificación fuera de `instruccion_mes`. */
  verificacion_suma?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatARS = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const formatUSD = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const estadoConfig = {
  infrapon: { label: "Infraponderada", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: TrendingDown },
  sobrepon: { label: "Sobreponderada", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", icon: TrendingUp },
  ok: { label: "En objetivo", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300", icon: CheckCircle2 },
  ausente: { label: "Ausente", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300", icon: PlusCircle },
  fuera_objetivo: { label: "Fuera del obj.", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", icon: MinusCircle },
};

const accionConfig = {
  agregar: { label: "Agregar", color: "text-green-600 dark:text-green-400" },
  no_agregar: { label: "No agregar", color: "text-red-500 dark:text-red-400" },
  evaluar: { label: "Evaluar", color: "text-amber-600 dark:text-amber-400" },
  mantener: { label: "Mantener", color: "text-slate-500 dark:text-slate-400" },
};

const sesgoConfig = {
  sobreponderar: { label: "Sobreponderar", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  subponderar:   { label: "Subponderar",   color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  neutral:       { label: "Neutral",       color: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  saltear:       { label: "Saltear",       color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};

const alertaConfig = {
  critica: { icon: XCircle, color: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30", iconColor: "text-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  advertencia: { icon: AlertTriangle, color: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30", iconColor: "text-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  oportunidad: { icon: Zap, color: "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30", iconColor: "text-green-500", badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  info: { icon: Info, color: "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30", iconColor: "text-blue-500", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function DropZone({ onFile, file }: { onFile: (f: File) => void; file: File | null }) {
  const onDrop = useCallback((accepted: File[]) => { if (accepted[0]) onFile(accepted[0]); }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [".pdf"] }, maxFiles: 1,
  });
  return (
    <div {...getRootProps()} className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
      ${isDragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/20"}`}>
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {file ? (
          <><FileText className="w-9 h-9 text-primary" /><div><p className="font-medium text-sm">{file.name}</p><p className="text-xs text-muted-foreground mt-1">Clic para cambiar</p></div></>
        ) : (
          <><Upload className={`w-9 h-9 transition-colors ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
            <div><p className="font-medium text-sm">{isDragActive ? "Soltá el PDF acá" : "Arrastrá el PDF de Cocos Capital"}</p><p className="text-xs text-muted-foreground mt-1">o hacé clic para seleccionarlo</p></div></>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div><p className="text-xs text-muted-foreground mb-1">{label}</p><p className="text-2xl font-semibold tracking-tight">{value}</p>{sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}</div>
          <div className="p-2 rounded-lg bg-muted"><Icon className="w-4 h-4 text-muted-foreground" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function PosicionRow({ p }: { p: Posicion }) {
  const cfg = estadoConfig[p.estado];
  const accion = accionConfig[p.accion];
  const Icon = cfg.icon;
  const barPct = p.peso_objetivo > 0 ? Math.min((p.peso_actual / p.peso_objetivo) * 100, 100) : 0;
  const isOver = p.peso_objetivo > 0 && p.peso_actual > p.peso_objetivo;

  return (
    <div className="py-4 border-b last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-14 shrink-0">
          <span className="font-mono font-semibold text-sm">{p.ticker}</span>
          {p.cantidad > 0 && <p className="text-xs text-muted-foreground">×{p.cantidad}</p>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm font-medium">{p.nombre}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${cfg.color}`}>
              <Icon className="w-2.5 h-2.5 mr-0.5" />{cfg.label}
            </Badge>
            <span className={`text-xs font-medium ${accion.color}`}>{accion.label}</span>
            {p.sesgo_mes && sesgoConfig[p.sesgo_mes] && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${sesgoConfig[p.sesgo_mes].color}`}>
                {sesgoConfig[p.sesgo_mes].label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
            <span>Actual <strong className="text-foreground">{p.peso_actual.toFixed(1)}%</strong></span>
            <span>Obj. <strong className="text-foreground">{p.peso_objetivo.toFixed(1)}%</strong></span>
            {p.diferencia !== 0 && <span className={p.diferencia < 0 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}>{p.diferencia > 0 ? "+" : ""}{p.diferencia.toFixed(1)}pp</span>}
            {p.ganancia_pct !== 0 && <span className={p.ganancia_pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}>{p.ganancia_pct >= 0 ? "▲" : "▼"} {Math.abs(p.ganancia_pct).toFixed(1)}%</span>}
            {p.variacion_mensual_pct !== undefined && p.variacion_mensual_pct !== 0 && (
              <span className={p.variacion_mensual_pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                {p.variacion_mensual_pct >= 0 ? "▲" : "▼"} {Math.abs(p.variacion_mensual_pct).toFixed(1)}% mes
              </span>
            )}
          </div>
          {p.peso_objetivo > 0 && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : p.estado === "ok" ? "bg-green-400" : "bg-amber-400"}`} style={{ width: `${barPct}%` }} />
            </div>
          )}
          {p.nota && <p className="text-[11px] text-muted-foreground mt-1.5 italic">{p.nota}</p>}
        </div>
        {p.valor_ars > 0 && (
          <div className="text-right shrink-0">
            <p className="text-sm font-medium">{formatARS(p.valor_ars)}</p>
            {p.precio_cedear_ars > 0 && <p className="text-[10px] text-muted-foreground">${p.precio_cedear_ars.toLocaleString("es-AR")}/u</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ReporteDisplay ───────────────────────────────────────────────────────────

export function ReporteDisplay({ reporte, footer }: { reporte: ReportePortafolio; footer?: React.ReactNode }) {
  const posicionesSafe = Array.isArray(reporte.posiciones) ? reporte.posiciones : [];
  const alertasSafe = Array.isArray(reporte.alertas) ? reporte.alertas : [];
  const proximosBalancesSafe = Array.isArray(reporte.proximos_balances)
    ? reporte.proximos_balances
    : [];
  const dividendosSafe = Array.isArray(reporte.dividendos_esperados)
    ? reporte.dividendos_esperados
    : [];
  const instr =
    reporte.instruccion_mes && typeof reporte.instruccion_mes === "object"
      ? reporte.instruccion_mes
      : {
          intro: "",
          asignaciones: [] as Asignacion[],
          no_invertir: [] as string[],
          total_ars: 0,
        };
  const noInvertirSafe = Array.isArray(instr.no_invertir) ? instr.no_invertir : [];
  const asignacionesSafe = Array.isArray(instr.asignaciones) ? instr.asignaciones : [];

  const verificacion =
    instr.verificacion_suma ??
    ("verificacion_suma" in reporte ? reporte.verificacion_suma : undefined);

  const posicionesOrden = posicionesSafe.slice().sort((a, b) => {
    const o: Record<string, number> = { sobrepon: 0, infrapon: 1, ausente: 2, fuera_objetivo: 3, ok: 4 };
    return (o[a.estado] ?? 5) - (o[b.estado] ?? 5);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Valor total" value={formatUSD(reporte.valor_total_usd)} sub={formatARS(reporte.valor_total_ars)} icon={DollarSign} />
        <MetricCard label="CCL del día" value={`$${reporte.ccl_actual.toLocaleString("es-AR")}`} sub="Tipo de cambio" icon={TrendingUp} />
        <MetricCard label="Aporte mensual" value={formatARS(reporte.aporte_mensual_ars)} sub={`≈ ${formatUSD(reporte.aporte_mensual_usd)}`} icon={ArrowRight} />
        <MetricCard label="Posiciones activas" value={`${posicionesSafe.filter((p) => p.cantidad > 0).length}`} sub={`${posicionesSafe.filter((p) => p.estado === "ausente").length} ausentes del obj.`} icon={FileText} />
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <p className="text-sm leading-relaxed">{reporte.resumen_ejecutivo}</p>
          <p className="text-xs text-muted-foreground mt-2">Generado el {reporte.fecha_reporte}</p>
        </CardContent>
      </Card>

      {alertasSafe.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Alertas</h2>
          {alertasSafe.map((a, i) => {
            const cfg = alertaConfig[a.tipo];
            const Icon = cfg.icon || Info;
            return (
              <div key={i} className={`flex gap-3 p-4 rounded-lg border ${cfg.color}`}>
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconColor}`} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{a.titulo}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${cfg.badge}`}>{a.ticker}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.detalle}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            Cómo invertir este mes
            {verificacion === true && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" aria-hidden />
            )}
            {verificacion === false && (
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 ml-auto shrink-0" aria-hidden />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{instr.intro}</p>
          <Separator />
          <div className="space-y-3">
            {asignacionesSafe.map((a, i) => (
              <div key={`${a.ticker}-${i}`} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{a.ticker}</span>
                    <span className="text-sm text-muted-foreground">{a.nombre}</span>
                    {a.sesgo && sesgoConfig[a.sesgo] ? (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${sesgoConfig[a.sesgo].color}`}>
                        {sesgoConfig[a.sesgo].label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.razon}</p>
                  {(a.peso_objetivo !== undefined || a.peso_asignado_mes !== undefined) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Obj. modelo {a.peso_objetivo !== undefined ? `${a.peso_objetivo.toFixed(1)}%` : "—"}
                      {" · "}
                      Asign. mes {a.peso_asignado_mes !== undefined ? `${a.peso_asignado_mes.toFixed(1)}%` : "—"}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatARS(a.monto_ars)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatUSD(a.monto_usd)}</p>
                </div>
              </div>
            ))}
          </div>
          {noInvertirSafe.length > 0 && (
            <><Separator />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">No invertir:</span>
                {noInvertirSafe.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs font-mono text-red-500 border-red-200 dark:border-red-900">{t}</Badge>
                ))}
              </div></>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Estado del portafolio</CardTitle></CardHeader>
        <CardContent>
          {posicionesOrden.map(p => <PosicionRow key={p.ticker} p={p} />)}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {proximosBalancesSafe.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4" />Próximos balances</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {proximosBalancesSafe.map((b, i) => (
                <div key={`${b.ticker}-${i}`} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between text-sm border-b border-border/60 last:border-0 pb-2 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{b.ticker}</span>
                    {b.en_cartera ? <Badge variant="outline" className="text-[10px]">En cartera</Badge> : null}
                    {b.impacto_esperado ? (
                      <Badge variant="secondary" className="text-[10px] font-normal capitalize">
                        {b.impacto_esperado}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground text-xs shrink-0">{b.fecha}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {dividendosSafe.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Dividendos esperados</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {dividendosSafe.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div><span className="font-mono font-semibold">{d.ticker}</span><span className="text-muted-foreground text-xs ml-2">{d.frecuencia}</span></div>
                  <span className="text-green-600 dark:text-green-400 text-xs font-medium">USD {d.monto_usd_por_accion}/acción</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 pb-4">
        <p className="text-xs text-muted-foreground text-center">
          Reporte informativo. No constituye asesoramiento financiero. Consultá con un asesor matriculado antes de operar.
        </p>
        {footer}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "portfolio_reporte_cache";

export function PortfolioAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState<ReportePortafolio | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ReportePortafolio) : null;
    } catch { return null; }
  });
  const [fromCache, setFromCache] = useState<boolean>(() => {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
  });
  const [error, setError] = useState<string | null>(null);

  const saveReporte = (r: ReportePortafolio) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    setReporte(r);
    setFromCache(false);
  };

  const clearCache = () => {
    localStorage.removeItem(STORAGE_KEY);
    setReporte(null);
    setFromCache(false);
    setFile(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append("portfolio_pdf", file);
      const res = await fetch("/api/analyze-portfolio", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al analizar.");
      saveReporte(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporte mensual de portafolio</h1>
        <p className="text-muted-foreground text-sm mt-1">Subí el snapshot de Cocos Capital y Claude analiza tu cartera al día de hoy.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <DropZone onFile={setFile} file={file} />
          <Button onClick={handleAnalyze} disabled={!file || loading} className="w-full" size="lg">
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando… esto puede tardar unos segundos</>
              : <><Zap className="w-4 h-4 mr-2" />Generar reporte del mes</>}
          </Button>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/40 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </CardContent>
      </Card>

      {reporte && (
        <>
          {fromCache && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 text-sm">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Mostrando el último reporte guardado ({reporte.fecha_reporte}). Subí un nuevo PDF para actualizar.</span>
              </div>
              <Button variant="outline" size="sm" onClick={clearCache} className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40">
                Nuevo análisis
              </Button>
            </div>
          )}
          <ReporteDisplay
            reporte={reporte}
            footer={!fromCache && (
              <Button variant="ghost" size="sm" onClick={clearCache} className="text-xs text-muted-foreground hover:text-foreground">
                Limpiar y hacer nuevo análisis
              </Button>
            )}
          />
        </>
      )}
    </div>
  );
}