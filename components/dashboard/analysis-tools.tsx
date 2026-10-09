import Link from "next/link";
import { TrendingUp, Target, Wallet, PieChart, ArrowRight } from "lucide-react";
import { formatUSD } from "@/lib/format";
import type { RealGainsSummary } from "@/lib/real-gains-data";
import type { RetirementSettingsData } from "@/app/actions/retirement";
import type { ConcentrationItem } from "@/lib/analysis-data";
import type { RetirementGoal } from "@/lib/projections";

interface AnalysisToolsProps {
  realGains: RealGainsSummary | null;
  retirementGoal: RetirementGoal | null;
  retirementSettings: RetirementSettingsData | null;
  // Señales del último reporte de oportunidades (Plan DCA); null si no hay.
  latestSignals: { buy: number; dateLabel: string } | null;
  topSector: ConcentrationItem | null;
  totalSectors: number;
}

export function AnalysisTools({
  realGains,
  retirementGoal,
  retirementSettings,
  latestSignals,
  topSector,
  totalSectors,
}: AnalysisToolsProps) {
  const realGainUsd = realGains?.totalGainUsdReal ?? null;
  const realGainAppreciation = realGains?.totalGainUsdAppreciation ?? null;
  const realGainCclImpact = realGains?.totalGainUsdCclImpact ?? null;
  const realGainIsPositive = realGainUsd !== null ? realGainUsd >= 0 : true;
  const realGainCoverage =
    realGains && realGains.positionsTotal > 0
      ? realGains.positionsWithFullData / realGains.positionsTotal
      : null;

  const buySignals = latestSignals?.buy ?? 0;

  return (
    <section className="animate-fade-up flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-foreground">Herramientas de análisis</h2>
        <p className="text-xs text-muted-foreground">
          Resumen de las funciones avanzadas del portfolio
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ganancia Real */}
        <Link
          href="/real-gains"
          className="group rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-success/10 p-1.5">
                <TrendingUp className="size-4 text-success" />
              </div>
              <span className="text-sm font-semibold text-foreground">Ganancia Real</span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className={`text-xl font-bold font-mono tabular-nums leading-none ${
                realGainUsd !== null
                  ? realGainIsPositive
                    ? "text-success"
                    : "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {realGainUsd !== null
                ? `${realGainIsPositive ? "+" : ""}${formatUSD(realGainUsd)}`
                : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {realGainAppreciation !== null && realGainCclImpact !== null
                ? `Subyacente ${realGainAppreciation >= 0 ? "+" : ""}${formatUSD(realGainAppreciation)} · CCL ${realGainCclImpact >= 0 ? "+" : ""}${formatUSD(realGainCclImpact)}`
                : "Ganancia en USD ajustada por CCL"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-auto">
            <span
              className={`size-2 rounded-full shrink-0 ${
                realGainCoverage !== null && realGainCoverage >= 0.8
                  ? "bg-success"
                  : realGainCoverage !== null
                    ? "bg-warning"
                    : "bg-muted-foreground/40"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {realGainCoverage !== null
                ? `${realGains!.positionsWithFullData}/${realGains!.positionsTotal} posiciones con datos`
                : "sin transacciones registradas"}
            </span>
          </div>
        </Link>

        {/* Jubilación */}
        <Link
          href="/retirement"
          className="group rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <Target className="size-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">Jubilación</span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className={`text-xl font-bold leading-none ${
                retirementGoal === null
                  ? "text-muted-foreground"
                  : retirementGoal.isOnTrack
                    ? "text-success"
                    : "text-warning"
              }`}
            >
              {retirementGoal === null
                ? retirementSettings === null
                  ? "Sin configurar"
                  : "—"
                : retirementGoal.isOnTrack
                  ? "En camino"
                  : "Requiere atención"}
            </span>
            <span className="text-xs text-muted-foreground">
              {retirementGoal !== null
                ? `${retirementGoal.yearsRemaining} años restantes · meta ${formatUSD(retirementGoal.capitalNeeded)}`
                : retirementSettings !== null
                  ? `${retirementSettings.retirementAge - retirementSettings.currentAge} años al retiro`
                  : "Configurá tu plan de retiro"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-auto">
            <span
              className={`size-2 rounded-full shrink-0 ${
                retirementGoal === null
                  ? "bg-muted-foreground/40"
                  : retirementGoal.isOnTrack
                    ? "bg-success"
                    : "bg-warning"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {retirementGoal !== null
                ? retirementGoal.isOnTrack
                  ? `Meta alcanzada en ~${retirementGoal.yearsToGoal.toFixed(1)} años`
                  : `Brecha ${formatUSD(retirementGoal.currentGap)}`
                : retirementSettings !== null
                  ? "configurado · sin valor USD"
                  : "planificación de largo plazo"}
            </span>
          </div>
        </Link>

        {/* Plan DCA */}
        <Link
          href="/plan"
          className="group rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-1.5 ${buySignals > 0 ? "bg-success/10" : "bg-muted"}`}>
                <Wallet className={`size-4 ${buySignals > 0 ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <span className="text-sm font-semibold text-foreground">Plan DCA</span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className={`text-xl font-bold font-mono tabular-nums leading-none ${
                buySignals > 0 ? "text-success" : "text-muted-foreground"
              }`}
            >
              {latestSignals === null
                ? "Sin reporte"
                : buySignals > 0
                  ? `${buySignals} en compra`
                  : "Sin compras"}
            </span>
            <span className="text-xs text-muted-foreground">
              {latestSignals === null
                ? "El aporte se reparte en partes iguales"
                : buySignals > 0
                  ? "Ahí va el aporte del mes"
                  : "El aporte va a las acciones en mantener"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-auto">
            <span className={`size-2 rounded-full shrink-0 ${buySignals > 0 ? "bg-success" : "bg-muted-foreground/40"}`} />
            <span className="text-xs text-muted-foreground">
              {latestSignals ? `Señales del reporte del ${latestSignals.dateLabel}` : "Generá un reporte de oportunidades"}
            </span>
          </div>
        </Link>

        {/* Concentración / Análisis */}
        <Link
          href="/analysis"
          className="group rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-chart-4/10 p-1.5">
                <PieChart className="size-4 text-chart-4" />
              </div>
              <span className="text-sm font-semibold text-foreground">Concentración</span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xl font-bold leading-none text-foreground truncate">
              {topSector !== null ? topSector.name : "Sin datos"}
            </span>
            <span className="text-xs text-muted-foreground">
              {topSector !== null
                ? `${topSector.pct.toFixed(1)}% del portfolio · sector dominante`
                : "Clasificá los assets para ver el análisis"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-auto">
            <span
              className={`size-2 rounded-full shrink-0 ${
                topSector !== null ? "bg-chart-4" : "bg-muted-foreground/40"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {totalSectors > 0
                ? `${totalSectors} sector${totalSectors > 1 ? "es" : ""} distintos`
                : "análisis de concentración"}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
