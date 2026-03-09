import type { Metadata } from "next";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getAllSnapshotPoints } from "@/lib/portfolio-data";
import { SiteHeader } from "@/components/layout/site-header";
import { PerformanceChart } from "@/components/performance/performance-chart";
import { BenchmarkOverlayChart } from "@/components/performance/benchmark-overlay-chart";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { getBenchmarkPoints } from "@/app/actions/benchmarks";
import type { BenchmarkId } from "@/lib/benchmarks-config";

export const metadata: Metadata = { title: "Performance" };

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function calcCAGR(first: number, last: number, years: number): number {
  if (years <= 0 || first <= 0) return 0;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

function calcMaxDrawdown(points: number[]): number {
  let maxDrawdown = 0;
  let peak = points[0] ?? 0;
  for (const p of points) {
    if (p > peak) peak = p;
    const dd = peak > 0 ? (peak - p) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  return maxDrawdown * 100;
}

export default async function PerformancePage() {
  const snapshots = await getAllSnapshotPoints();

  const benchmarkIds: BenchmarkId[] = ["sp500", "merval", "nasdaq"];
  const fromDate = snapshots.length > 0 ? new Date(snapshots[0].snapshotDate) : undefined;

  const benchmarkResults = await Promise.all(
    benchmarkIds.map((id) => getBenchmarkPoints(id, fromDate))
  );
  const initialBenchmarks = Object.fromEntries(
    benchmarkIds.map((id, i) => [id, benchmarkResults[i]])
  );

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col min-h-svh">
        <SiteHeader title="Performance" description="Historial del portfolio" actions={<ImportButton />} />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="flex flex-col items-center gap-3 text-center max-w-xs">
            <TrendingUp className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              Sin historial disponible
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Importá al menos un snapshot para ver la evolución del portfolio.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  const currentYear = new Date().getFullYear();

  // Base del año: último snapshot del año anterior, o el primero disponible si todo es del año en curso
  const yearBase =
    [...snapshots].reverse().find((s) => s.snapshotDate.getFullYear() < currentYear) ??
    snapshots.find((s) => s.snapshotDate.getFullYear() === currentYear) ??
    first;

  const yearGainArs = last.totalValueArs - yearBase.totalValueArs;
  const yearGainPct =
    yearBase.totalValueArs > 0
      ? (yearGainArs / yearBase.totalValueArs) * 100
      : 0;

  const daysDiff =
    (last.snapshotDate.getTime() - first.snapshotDate.getTime()) /
    (1000 * 60 * 60 * 24);
  const yearsDiff = daysDiff / 365;

  const cagr = calcCAGR(first.totalValueArs, last.totalValueArs, yearsDiff);
  const maxDD = calcMaxDrawdown(snapshots.map((s) => s.totalValueArs));

  const kpis = [
    {
      label: `Rendimiento ${currentYear}`,
      value: `${yearGainPct >= 0 ? "+" : ""}${yearGainPct.toFixed(2)}%`,
      sub: `${yearGainPct >= 0 ? "+" : ""}${formatARS(yearGainArs)}`,
      accent: yearGainPct >= 0,
    },
    {
      label: "CAGR",
      value: yearsDiff >= 0.1 ? `${cagr >= 0 ? "+" : ""}${cagr.toFixed(2)}%` : "—",
      sub: "Tasa anual compuesta",
      accent: cagr >= 0,
    },
    {
      label: "Máx. Drawdown",
      value: maxDD > 0 ? `-${maxDD.toFixed(2)}%` : "—",
      sub: "Mayor caída desde pico",
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
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Performance" description="Historial del portfolio" actions={<ImportButton />} />

      <main className="flex-1 px-6 py-10 flex flex-col gap-10 max-w-6xl w-full mx-auto">
        {/* KPI row */}
        <section className="animate-fade-up grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  <ArrowUpRight className="size-4 text-emerald-500 shrink-0" />
                )}
                {accent === false && maxDD > 0 && (
                  <ArrowDownRight className="size-4 text-destructive shrink-0" />
                )}
                <span
                  className={`text-xl font-bold font-mono tabular-nums leading-none ${
                    accent === true
                      ? "text-emerald-500"
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
                  className={`size-2 rounded-full shrink-0 ${accent === false && maxDD > 0 ? "bg-destructive/50" : "bg-emerald-500/50"}`}
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
                snapshots={snapshots}
                initialBenchmarks={initialBenchmarks}
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
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="divide-y divide-border">
              {[...snapshots].reverse().map((s, i) => {
                const prev = snapshots[snapshots.length - 2 - i];
                const change = prev
                  ? ((s.totalValueArs - prev.totalValueArs) / prev.totalValueArs) * 100
                  : null;
                const pos = change !== null && change >= 0;

                return (
                  <div
                    key={s.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-2 rounded-full bg-emerald-500/50 shrink-0" />
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
                          className={`text-xs font-mono tabular-nums ${
                            pos ? "text-emerald-500" : "text-destructive"
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
    </div>
  );
}
