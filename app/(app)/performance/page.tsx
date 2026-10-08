import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatARS, formatDateUTC, formatUSD } from "@/lib/format";
import { performanceSeries } from "@/lib/snapshot-returns";
import { returnSummary } from "@/lib/flow-returns";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Performance" };

type Currency = "ARS" | "USD";
type PerformanceSearchParams = Promise<{ moneda?: string | string[] }>;

function fmtSignedPct(value: number | null): string {
  return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

// El header entra al static shell; la moneda (searchParams), los snapshots, los
// benchmarks y los índices se leen en request time detrás del skeleton.
export default function PerformancePage({ searchParams }: { searchParams: PerformanceSearchParams }) {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Performance" description="Historial del portfolio" />
      <Suspense fallback={<PerformanceSkeleton />}>
        <PerformanceContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PerformanceContent({ searchParams }: { searchParams: PerformanceSearchParams }) {
  const [{ moneda }, snapshots, flows] = await Promise.all([
    searchParams,
    getAllSnapshotPoints(),
    getHoldingsFlows(),
  ]);
  const currency: Currency = (Array.isArray(moneda) ? moneda[0] : moneda)?.toLowerCase() === "usd" ? "USD" : "ARS";

  // Las métricas de rendimiento y los gráficos normalizados arrancan en el
  // primer snapshot con valor: un snapshot de $0 no sirve de base (lib/snapshot-returns).
  const series = performanceSeries(snapshots);
  // En USD, solo los snapshots con valor en dólares (los que tienen CCL).
  const usdSeries = series.filter((s) => s.totalValueUsd !== null && s.totalValueUsd > 0);
  const activeSeries = currency === "USD" ? usdSeries : series;
  const seriesStart = activeSeries[0] ?? snapshots[0];

  const benchmarkIds: BenchmarkId[] = ["sp500", "merval", "nasdaq"];
  const fromDate = seriesStart ? new Date(seriesStart.snapshotDate) : undefined;

  const benchmarkResults = await Promise.all(
    benchmarkIds.map((id) => getBenchmarkPoints(id, fromDate))
  );
  const initialBenchmarks = Object.fromEntries(
    benchmarkIds.map((id, i) => [id, benchmarkResults[i]])
  );

  const indexIds: IndexBenchmarkId[] = ["inflacion", "cer"];
  // La inflación se compara siempre en pesos: arranca con la serie en ARS.
  const indexResults = await Promise.all(
    indexIds.map((id) => getIndexPoints(id, series[0]?.snapshotDate))
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

  const last = snapshots[snapshots.length - 1];

  // Después de las lecturas de request: con Cache Components, la hora no puede
  // leerse durante el prerender del shell.
  const currentYear = new Date().getFullYear();

  // Rendimiento sin aportes (lib/flow-returns, ADR-0019): el valor sube con cada
  // compra o suscripción al FCI, así que se mide contra los flujos de las tenencias.
  // En USD, cada snapshot vale lo que dice al CCL de su fecha y cada flujo se pasa
  // al CCL de la suya.
  const arsPoints = series.map((s) => ({ date: s.snapshotDate, value: s.totalValueArs }));
  const usdPoints = usdSeries.map((s) => ({ date: s.snapshotDate, value: s.totalValueUsd! }));
  const arsSummary = returnSummary(arsPoints, flows.flowsArs, currentYear);
  const summary =
    currency === "USD" ? returnSummary(usdPoints, flows.flowsUsd, currentYear) : arsSummary;

  // Sin movimientos importados hasta el último snapshot, los rescates del FCI o
  // las ventas de esos días se leen como pérdida.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const coverageGap =
    flows.lastMovementDate === null
      ? "none"
      : flows.lastMovementDate.getTime() < last.snapshotDate.getTime() - DAY_MS
        ? "partial"
        : null;

  const toValues = (pts: { date: Date | string; normalizedValue: number | null }[]) =>
    pts
      .filter((p) => p.normalizedValue !== null)
      .map((p) => ({ date: new Date(p.date), value: p.normalizedValue as number }));

  // Tercer KPI: en pesos, la TIR descontando la inflación (IPC; fallback CER);
  // en dólares, el rendimiento anual contra el S&P 500 del mismo período.
  let thirdKpi: { label: string; value: string; sub: string; accent: boolean | null };
  if (currency === "ARS") {
    const ipcValues = toValues(initialIndices.inflacion);
    const inflationSeries = ipcValues.length > 1 ? ipcValues : toValues(initialIndices.cer);
    const inflationPct =
      inflationSeries.length > 0 && series.length > 0
        ? indexChangePct(inflationSeries, series[0].snapshotDate, last.snapshotDate)
        : null;
    const inflationAnnual =
      inflationPct !== null && summary ? annualize(inflationPct, summary.years) : null;
    const realTir =
      inflationAnnual !== null && summary?.tirPct != null
        ? realReturnPct(summary.tirPct, inflationAnnual)
        : null;
    thirdKpi = {
      label: "TIR real",
      value: fmtSignedPct(realTir),
      sub:
        inflationPct !== null
          ? `vs inflación ${inflationPct >= 0 ? "+" : ""}${inflationPct.toFixed(1)}%`
          : "Sin índices cargados",
      accent: realTir !== null ? realTir >= 0 : null,
    };
  } else {
    const spValues = toValues(initialBenchmarks.sp500 ?? []);
    const spPct =
      spValues.length > 1 && usdSeries.length > 1
        ? indexChangePct(spValues, usdSeries[0].snapshotDate, usdSeries[usdSeries.length - 1].snapshotDate)
        : null;
    const spAnnual = spPct !== null && summary ? annualize(spPct, summary.years) : null;
    const diff =
      spAnnual !== null && summary?.twrAnnualPct != null ? summary.twrAnnualPct - spAnnual : null;
    thirdKpi = {
      label: "vs S&P 500",
      value: diff === null ? "—" : `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} pp`,
      sub:
        spAnnual !== null
          ? `S&P 500 ${fmtSignedPct(spAnnual)} anual; portfolio ${fmtSignedPct(summary?.twrAnnualPct ?? null)}`
          : "Cargá el S&P 500 en el gráfico de benchmarks",
      accent: diff !== null ? diff >= 0 : null,
    };
  }

  const formatMoney = currency === "USD" ? formatUSD : formatARS;
  const maxDD = summary?.maxDrawdownPct ?? 0;
  const yearGain = summary?.yearGain ?? 0;
  const yearReturn = summary?.yearReturnPct ?? null;
  const tir = summary?.tirPct ?? null;

  const kpis = [
    {
      label: `Rendimiento ${currentYear}`,
      value: fmtSignedPct(yearReturn),
      sub: `Ganancia ${yearGain >= 0 ? "+" : ""}${formatMoney(yearGain)} sin aportes`,
      accent: yearReturn !== null ? yearReturn >= 0 : null,
    },
    {
      label: currency === "USD" ? "TIR anual en USD" : "TIR anual",
      value: fmtSignedPct(tir),
      sub: "Rendimiento anual, sin contar aportes",
      accent: tir !== null ? tir >= 0 : null,
    },
    thirdKpi,
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

  const activeIndex = (summary?.index ?? []).map((p) => p.index);
  const arsIndex = (arsSummary?.index ?? []).map((p) => p.index);

  return (
    <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
          {currency === "USD"
            ? "En dólares: cada snapshot al CCL de su fecha y cada compra, venta o movimiento del FCI al CCL del día en que se hizo."
            : "En pesos. Para sacar la devaluación y compararte con el S&P 500 o el NASDAQ, mirá el análisis en dólares."}
        </p>
        <nav aria-label="Moneda" className="flex gap-1.5">
          {(["ARS", "USD"] as Currency[]).map((c) => (
            <Button
              key={c}
              asChild
              size="sm"
              variant={c === currency ? "default" : "outline"}
              className={cn("font-mono", c === currency && "pointer-events-none")}
            >
              <Link
                href={c === "USD" ? "/performance?moneda=usd" : "/performance"}
                aria-current={c === currency ? "page" : undefined}
              >
                {c === "USD" ? "Dólares" : "Pesos"}
              </Link>
            </Button>
          ))}
        </nav>
      </div>

      {currency === "USD" && usdSeries.length < 2 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <p>Hacen falta al menos dos snapshots con CCL para medir el rendimiento en dólares.</p>
        </div>
      )}

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
              {accent === false && (label !== "Máx. Drawdown" || maxDD > 0) && (
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
                className={`size-2 rounded-full shrink-0 ${accent === false && (label !== "Máx. Drawdown" || maxDD > 0) ? "bg-destructive/50" : "bg-success/50"}`}
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
            {/* key: con <Activity> el estado sobrevive a la navegación; al cambiar
                de moneda tiene que arrancar en la nueva. */}
            <PerformanceChart key={currency} snapshots={snapshots} initialCurrency={currency} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Comparación vs benchmarks
          </p>
          <p className="text-xs text-muted-foreground -mt-1">
            {currency === "USD"
              ? "Portfolio en dólares, sin aportes. El Merval está en pesos."
              : "Portfolio en pesos, sin aportes. El S&P 500 y el NASDAQ están en dólares: para compararlos sin la devaluación, pasá a dólares."}
          </p>
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <BenchmarkOverlayChart
              key={currency}
              snapshots={activeSeries}
              portfolioIndex={activeIndex}
              initialBenchmarks={initialBenchmarks}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Rendimiento real vs inflación{currency === "USD" ? " (en pesos)" : ""}
          </p>
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <InflationChart
              snapshots={series}
              portfolioIndex={arsIndex}
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
          El porcentaje es el rendimiento de cada período{currency === "USD" ? " en dólares" : ""}, sin contar compras, ventas ni movimientos del FCI.
        </p>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {[...snapshots].reverse().map((s) => {
              // Rendimiento del período que termina en este snapshot, sin aportes.
              const change = summary?.periodReturnByEnd.get(s.snapshotDate.getTime()) ?? null;
              const pos = change !== null && change >= 0;
              const value = currency === "USD" ? s.totalValueUsd : s.totalValueArs;

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
                      {value !== null ? formatMoney(value) : "—"}
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
