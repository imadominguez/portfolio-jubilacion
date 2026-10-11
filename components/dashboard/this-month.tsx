import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MOBILE_SNAP_CELL, MOBILE_SNAP_ROW } from "@/components/layout/page-parts";

interface ThisMonthProps {
  // Señales del último reporte de oportunidades; null si no hay reporte.
  dca: { buy: number; dateLabel: string } | null;
  // Reporte, hitos y assets se administran en páginas solo para admin.
  isAdmin: boolean;
  milestone: { label: string; targetUsd: number; currentUsd: number } | null;
  // Distingue "los alcanzaste todos" de "no definiste ninguno" cuando milestone es null.
  allMilestonesReached: boolean;
  topSector: { name: string; pct: number } | null;
}

// Lo que pide acción en el ciclo mensual (aporte DCA, próximo hito, la mayor
// concentración), en una fila con divisiones finas en lugar de tarjetas.
export function ThisMonth({ dca, isAdmin, milestone, allMilestonesReached, topSector }: ThisMonthProps) {
  const milestonePct = milestone ? Math.min(100, (milestone.currentUsd / milestone.targetUsd) * 100) : null;
  const cell = cn(
    "group flex min-w-0 flex-col gap-2 bg-card px-5 py-4 transition-colors hover:bg-muted/40 outline-none focus-visible:bg-muted/40",
    MOBILE_SNAP_CELL
  );

  return (
    <section aria-labelledby="this-month-title" className="flex flex-col gap-3">
      <h2 id="this-month-title" className="text-base font-semibold text-foreground">
        Este mes
      </h2>
      <div className={cn("gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3", MOBILE_SNAP_ROW)}>
        {dca ? (
          <Link href="/plan" className={cell}>
            <CellHead label="Plan DCA" />
            <p className="text-sm text-foreground">
              {dca.buy > 0 ? (
                <>
                  <span className="font-mono font-semibold tabular-nums">{dca.buy}</span>{" "}
                  {dca.buy === 1 ? "acción con señal de compra" : "acciones con señal de compra"}
                </>
              ) : (
                "Sin señales de compra: el aporte se reparte entre las que mantener"
              )}
            </p>
            <p className="text-xs text-muted-foreground">Reporte del {dca.dateLabel}</p>
          </Link>
        ) : (
          <Link href={isAdmin ? "/portfolio" : "/plan"} className={cell}>
            <CellHead label="Plan DCA" />
            <p className="text-sm text-foreground">
              {isAdmin ? "Generá un reporte de oportunidades para repartir el aporte" : "Todavía no hay señales para repartir el aporte"}
            </p>
          </Link>
        )}

        {milestone && milestonePct !== null ? (
          <MaybeLink href={isAdmin ? "/settings" : null} className={cell}>
            <CellHead label={`Próximo hito: ${milestone.label}`} />
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`Progreso hacia ${milestone.label}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(milestonePct)}
            >
              <div className="progress-fill h-full rounded-full bg-primary" style={{ width: `${milestonePct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground/80">{formatPct(milestonePct, { decimals: 1 })}</span> · faltan{" "}
              <span className="font-mono tabular-nums">{formatUSD(milestone.targetUsd - milestone.currentUsd)}</span>
            </p>
          </MaybeLink>
        ) : (
          <MaybeLink href={isAdmin ? "/settings" : null} className={cell}>
            <CellHead label="Hitos" />
            <p className="text-sm text-muted-foreground">
              {allMilestonesReached ? "Alcanzaste todos tus hitos." : "Todavía no hay hitos definidos."}
            </p>
          </MaybeLink>
        )}

        {topSector ? (
          <Link href="/analysis" className={cell}>
            <CellHead label="Mayor concentración" />
            <p className="text-sm text-foreground">
              {topSector.name}:{" "}
              <span className="font-mono font-semibold tabular-nums">{formatPct(topSector.pct, { decimals: 1 })}</span> del portfolio
            </p>
            <p className="text-xs text-muted-foreground">Sector con más peso en la cartera</p>
          </Link>
        ) : (
          <MaybeLink href={isAdmin ? "/assets" : null} className={cell}>
            <CellHead label="Concentración" />
            <p className="text-sm text-muted-foreground">Falta el sector de tus activos para verla</p>
          </MaybeLink>
        )}
      </div>
    </section>
  );
}

function MaybeLink({ href, className, children }: { href: string | null; className: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={cn(className, "hover:bg-card")}>{children}</div>
  );
}

function CellHead({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
    </div>
  );
}
