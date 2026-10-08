import { ArrowDownCircle, ArrowUpCircle, MinusCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OpportunityReport } from "@/lib/opportunity-report";

type Accion = OpportunityReport["acciones"][number];

const SENAL = {
  compra: { label: "Compra", icon: ArrowUpCircle, text: "text-success", soft: "bg-success/10", border: "border-success/30" },
  venta: { label: "Venta", icon: ArrowDownCircle, text: "text-destructive", soft: "bg-destructive/10", border: "border-destructive/30" },
  mantener: { label: "Mantener", icon: MinusCircle, text: "text-muted-foreground", soft: "bg-muted", border: "border-border" },
} as const;

const CONFIANZA = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" } as const;

function AccionCard({ a }: { a: Accion }) {
  const s = SENAL[a.senal];
  const Icon = s.icon;
  return (
    <div className={cn("rounded-xl border bg-card p-4 flex flex-col gap-3", s.border)}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-foreground">{a.ticker}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
            {CONFIANZA[a.confianza]}
          </Badge>
          <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", s.soft, s.text)}>
            <Icon className="size-3.5" />
            {s.label}
          </span>
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{a.motivo}</p>
      <dl className="grid gap-2 text-xs leading-relaxed sm:grid-cols-3">
        <div>
          <dt className="font-medium text-foreground">Precio</dt>
          <dd className="text-muted-foreground">{a.precio}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Noticias</dt>
          <dd className="text-muted-foreground">{a.noticias}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Riesgos</dt>
          <dd className="text-muted-foreground">{a.riesgos}</dd>
        </div>
      </dl>
    </div>
  );
}

function Grupo({ titulo, acciones }: { titulo: string; acciones: Accion[] }) {
  if (acciones.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {titulo} <span className="font-normal text-muted-foreground">({acciones.length})</span>
      </h3>
      <div className="flex flex-col gap-3">
        {acciones.map((a) => (
          <AccionCard key={a.ticker} a={a} />
        ))}
      </div>
    </section>
  );
}

function formatCost(costUsd: number | null): string {
  return costUsd === null ? "costo no disponible para este modelo" : `costo estimado US$ ${costUsd.toFixed(4)}`;
}

export function OpportunityReportDisplay({
  reporte,
  footer,
}: {
  reporte: OpportunityReport;
  footer?: React.ReactNode;
}) {
  const por = (senal: Accion["senal"]) => reporte.acciones.filter((a) => a.senal === senal);
  const { uso } = reporte;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reporte del {reporte.fecha_reporte}</CardTitle>
          <p className="text-xs text-muted-foreground">Tenencia del snapshot del {reporte.snapshot_fecha}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-foreground">{reporte.resumen}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["compra", "venta", "mantener"] as const).map((k) => (
              <span key={k} className={cn("rounded-md px-2 py-1", SENAL[k].soft, SENAL[k].text)}>
                {SENAL[k].label}: {por(k).length}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Grupo titulo="Oportunidades de compra" acciones={por("compra")} />
      <Grupo titulo="Alertas de venta" acciones={por("venta")} />
      <Grupo titulo="Mantener" acciones={por("mantener")} />

      {reporte.posiciones_sin_datos.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          Sin análisis por falta de precio o subyacente: {reporte.posiciones_sin_datos.join(", ")}.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span>
          {uso.model} · {uso.inputTokens.toLocaleString("es-AR")} tokens de entrada ·{" "}
          {uso.outputTokens.toLocaleString("es-AR")} de salida · {formatCost(uso.costUsd)}
        </span>
        {footer}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Análisis generado con IA a partir de precios y titulares públicos. No es asesoramiento financiero.
      </p>
    </div>
  );
}
