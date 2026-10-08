import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getAllSnapshotPoints, getHoldingsFlows } from "@/lib/portfolio-data";
import { SiteHeader } from "@/components/layout/site-header";
import { PerformanceChart } from "@/components/performance/performance-chart";
import { PerformanceSkeleton } from "@/components/performance/performance-skeleton";
import { BenchmarkOverlayChart } from "@/components/performance/benchmark-overlay-chart";
import { InflationChart } from "@/components/performance/inflation-chart";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { getBenchmarkPoints } from "@/app/actions/benchmarks";
import { getIndexPoints } from "@/app/actions/indices";
import type { BenchmarkId, IndexBenchmarkId } from "@/lib/benchmarks-config";
import { annualize, indexChangePct, realReturnPct } from "@/lib/inflation";
import { formatARS, formatDateUTC } from "@/lib/format";
import { maxDrawdownPct, performanceSeries } from "@/lib/snapshot-returns";
import {
  holdingsXirr,
  netContributions,
  periodReturns,
  twrBetween,
  twrIndex,
} from "@/lib/flow-returns";

export const metadata: Metadata = { title: "Performance" };

function fmtSignedPct(value: number | null): string {
  return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

// El header entra al static shell; snapshots, benchmarks e índices se leen en
// request time y se streamean detrás del skeleton.
export default function PerformancePage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Performance" description="Historial del portfolio" />
      <Suspense fallback={<PerformanceSkeleton />}>
        <PerformanceContent />
      </Suspense>
    </div>
  );
}

async function PerformanceContent() {
  const [snapshots, flows] = await Promise.all([getAllSnapshotPoints(), getHoldingsFlows()]);
  // Las métricas de rendimiento y los gráficos normalizados arrancan en el
  // primer snapshot con valor: un snapshot de $0 no sirve de base (lib/snapshot-returns).
  const series = performanceSeries(snapshots);
  const seriesStart = series[0] ?? snapshots[0];

  const benchmarkIds: BenchmarkId[] = ["sp500", "merval", "nasdaq"];
  const fromDate = seriesStart ? new Date(seriesStart.snapshotDate) : undefined;

  const benchmarkResults = await Promise.all(
    benchmarkIds.map((id) => getBenchmarkPoints(id, fromDate))
  );
  const initialBenchmarks = Object.fromEntries(
    benchmarkIds.map((id, i) => [id, benchmarkResults[i]])
  );

  const indexIds: IndexBenchmarkId[] = ["inflacion", "cer"];
  const indexResults = await Promise.all(
    indexIds.map((id) => getIndexPoints(id, fromDate))
  );
  const initialIndices = Object.fromEntries(
    indexIds.map((id, i) => [id, indexResults[i]])
  ) as Record<IndexBenchmarkId, (typeof indexResults)[number]>;

  if (snapshots.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <TrendingUp className="size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">
            Sin historial disponible
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Importá al menos un snapshot para ver la evolución del portfolio.
          </p>
          <ImportButton />
        </div>
      </main>
    );
  }

  const first = seriesStart;
  const last = snapshots[snapshots.length - 1];

  // Después de las lecturas de request: con Cache Components, la hora no puede
  // leerse durante el prerender del shell.
  const currentYear = new Date().getFullYear();

  // Base del año: último snapshot del año anterior, o el primero disponible si todo es del año en curso
  const yearBase =
    [...series].reverse().find((s) => s.snapshotDate.getFullYear() < currentYear) ??
    series.find((s) => s.snapshotDate.getFullYear() === currentYear) ??
    first;

  // Rendimiento sin aportes (lib/flow-returns, ADR-0019): el valor sube con cada
  // compra o suscripción al FCI, así que se mide contra los flujos de las tenencias.
  const { flowsArs } = flows;
  const points = series.map((s) => ({ date: s.snapshotDate, value: s.totalValueArs }));
  const index = twrIndex(points, flowsArs);

  const yearGainPct = twrBetween(points, flowsArs, yearBase.snapshotDate, last.snapshotDate);
  const yearGainArs =
    last.totalValueArs -
    yearBase.totalValueArs -
    netContributions(flowsArs, yearBase.snapshotDate, last.snapshotDate);

  const daysDiff =
    (last.snapshotDate.getTime() - first.snapshotDate.getTime()) /
    (1000 * 60 * 60 * 24);
  const yearsDiff = daysDiff / 365;

  const tir = yearsDiff >= 0.1 ? holdingsXirr(points, flowsArs) : null;
  const maxDD = maxDrawdownPct(index.flatMap((p) => (p.index === null ? [] : [p.index])));
  const returnByDate = new Map(
    periodReturns(points, flowsArs).map((p) => [p.end.getTime(), p.returnPct]),
  );

  // Sin movimientos importados hasta el último snapshot, los rescates del FCI o
  // las ventas de esos días se leen como pérdida.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const coverageGap =
    flows.lastMovementDate === null
      ? "none"
      : flows.lastMovementDate.getTime() < last.snapshotDate.getTime() - DAY_MS
        ? "partial"
        : null;

  // Inflación del período (IPC; fallback CER) y rendimiento real.
  const toValues = (pts: { date: Date | string; normalizedValue: number | null }[]) =>
    pts
      .filter((p) => p.normalizedValue !== null)
      .map((p) => ({ date: new Date(p.date), value: p.normalizedValue as number }));
  const ipcValues = toValues(initialIndices.inflacion);
  const cerValues = toValues(initialIndices.cer);
  const inflationSeries = ipcValues.length > 1 ? ipcValues : cerValues;
  const inflationPct =
    inflationSeries.length > 0
      ? indexChangePct(inflationSeries, first.snapshotDate, last.snapshotDate)
      : null;
  const inflationAnnual =
    inflationPct !== null ? annualize(inflationPct, yearsDiff) : null;
  const realTir =
    inflationAnnual !== null && tir !== null
      ? realReturnPct(tir, inflationAnnual)
      : null;

  const kpis = [
    {
      label: `Rendimiento ${currentYear}`,
      value: fmtSignedPct(yearGainPct),
      sub: `Ganancia ${yearGainArs >= 0 ? "+" : ""}${formatARS(yearGainArs)} sin aportes`,
      accent: yearGainPct !== null ? yearGainPct >= 0 : null,
    },
    {
      label: "TIR anual",
      value: fmtSignedPct(tir),
      sub: "Rendimiento anual, sin contar aportes",
      accent: tir !== null ? tir >= 0 : null,
    },
    {
      label: "TIR real",
      value: fmtSignedPct(realTir),
      sub:
        inflationPct !== null
          ? `vs inflación ${inflationPct >= 0 ? "+" : ""}${inflationPct.toFixed(1)}%`
          : "Sin índices cargados",
      accent: realTir !== null ? realTir >= 0 : null,
    },
    {
      label: "Máx. Drawdown",
      value: maxDD > 0 ? `-${maxDD.toFixed(2)}%` : "—",
      sub: "Mayor caída desde pico, sin aportes",
      accent: false,
    },
    {
      label: "Snapshots",
      value: snapshots.length.toString(),
      sub: `${snapshots.length === 1 ? "registro" : "registros"} importados`,
      accent: null,
    },
  ];

  return (
    <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
      {coverageGap && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <p>
            {coverageGap === "none"
              ? "No hay movimientos importados: el rendimiento cuenta como ganancia las compras y suscripciones al FCI. "
              : `Movimientos importados hasta el ${formatDateUTC(flows.lastMovementDate!)}: en los snapshots posteriores, los rescates del FCI o las ventas de esos días se leen como pérdida. `}
            <Link href="/transactions" className="text-primary underline-offset-4 hover:underline">
              Importá el CSV de Actividad
            </Link>{" "}
            para completarlos.
          </p>
        </div>
      )}

      {/* KPI row */}
      <section className="animate-fade-up grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(({ label, value, sub, accent }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{sub}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {accent === true && (
                <ArrowUpRight className="size-4 text-success shrink-0" />
              )}
              {accent === false && maxDD > 0 && (
                <ArrowDownRight className="size-4 text-destructive shrink-0" />
              )}
              <span
                className={`text-xl font-bold font-mono tabular-nums leading-none ${accent === true
                  ? "text-success"
                  : accent === false &&
                    (label === "Máx. Drawdown" ? maxDD > 0 : true)
                    ? "text-destructive"
                    : "text-foreground"
                  }`}
              >
                {value}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full shrink-0 ${accent === false && maxDD > 0 ? "bg-destructive/50" : "bg-success/50"}`}
              />
              <span className="text-xs text-muted-foreground">
                {accent === null ? "registros" : "del período"}
              </span>
            </div>
          </div>
        ))}
      </section>

      <Separator className="opacity-30" />

      {/* Charts */}
      <section
        className="animate-fade-up flex flex-col gap-6"
        style={{ animationDelay: "100ms" }}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Evolución del portfolio
          </p>
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <PerformanceChart snapshots={snapshots} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Comparación vs benchmarks
          </p>
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <BenchmarkOverlayChart
              snapshots={series}
              portfolioIndex={index.map((p) => p.index)}
              initialBenchmarks={initialBenchmarks}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Rendimiento real vs inflación
          </p>
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <InflationChart
              snapshots={series}
              portfolioIndex={index.map((p) => p.index)}
              initialIndices={initialIndices}
            />
          </div>
        </div>
      </section>

      {/* Snapshot timeline */}
      <section
        className="animate-fade-up flex flex-col gap-3"
        style={{ animationDelay: "200ms" }}
      >
        <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
          Registros importados
        </p>
        <p className="text-xs text-muted-foreground -mt-1">
          El porcentaje es el rendimiento de cada período, sin contar compras, ventas ni movimientos del FCI.
        </p>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {[...snapshots].reverse().map((s) => {
              // Rendimiento del período que termina en este snapshot, sin aportes.
              const change = returnByDate.get(s.snapshotDate.getTime()) ?? null;
              const pos = change !== null && change >= 0;

              return (
                <div
                  key={s.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-success/50 shrink-0" />
                    <span className="text-sm font-mono text-foreground">
                      {new Intl.DateTimeFormat("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(s.snapshotDate))}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono tabular-nums text-foreground">
                      {formatARS(s.totalValueArs)}
                    </span>
                    {change !== null && (
                      <span
                        className={`text-xs font-mono tabular-nums ${pos ? "text-success" : "text-destructive"
                          }`}
                      >
                        {pos ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
