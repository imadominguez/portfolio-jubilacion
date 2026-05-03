import type { Metadata } from "next";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/layout/site-header";
import { CCLChart } from "@/components/ccl/ccl-chart";
import { getAllExchangeRates } from "@/app/actions/exchange-rate";
import { getAllSnapshotPoints } from "@/lib/portfolio-data";
import { ImportButton } from "@/components/snapshots/snapshots-client";

export const metadata: Metadata = { title: "Historial CCL" };

function formatCCL(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default async function CCLPage() {
  const [rates, snapshots] = await Promise.all([
    getAllExchangeRates(),
    getAllSnapshotPoints(),
  ]);

  if (rates.length === 0) {
    return (
      <div className="flex flex-col min-h-svh">
        <SiteHeader
          title="Historial CCL"
          description="Contado con Liquidación"
          actions={<ImportButton />}
        />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="flex flex-col items-center gap-3 text-center max-w-xs">
            <Activity className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              Sin datos de CCL
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Actualizá el CCL desde el panel de Assets para comenzar a
              registrar el historial.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const now = new Date();
  const latest = rates[rates.length - 1];
  const cclNow = latest.ccl;

  // CCL hace 1 mes
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const rate1m = [...rates]
    .reverse()
    .find((r) => new Date(r.date) <= oneMonthAgo);
  const ccl1m = rate1m?.ccl ?? null;
  const change1m =
    ccl1m && ccl1m > 0 ? ((cclNow - ccl1m) / ccl1m) * 100 : null;

  // CCL hace 1 año
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const rate1y = [...rates]
    .reverse()
    .find((r) => new Date(r.date) <= oneYearAgo);
  const ccl1y = rate1y?.ccl ?? null;
  const change1y =
    ccl1y && ccl1y > 0 ? ((cclNow - ccl1y) / ccl1y) * 100 : null;

  // CCL inicio del año
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const rateYTD = rates.find((r) => new Date(r.date) >= startOfYear);
  const cclYTD = rateYTD?.ccl ?? null;
  const changeYTD =
    cclYTD && cclYTD > 0 ? ((cclNow - cclYTD) / cclYTD) * 100 : null;

  const kpis = [
    {
      label: "CCL Actual",
      value: formatCCL(cclNow),
      sub: formatDate(latest.date),
      change: null,
    },
    {
      label: "Variación 1 mes",
      value: change1m !== null ? `${change1m >= 0 ? "+" : ""}${change1m.toFixed(2)}%` : "—",
      sub: ccl1m ? `vs ${formatCCL(ccl1m)}` : "Sin datos",
      change: change1m,
    },
    {
      label: "Variación YTD",
      value:
        changeYTD !== null
          ? `${changeYTD >= 0 ? "+" : ""}${changeYTD.toFixed(2)}%`
          : "—",
      sub: cclYTD ? `vs ${formatCCL(cclYTD)}` : "Sin datos",
      change: changeYTD,
    },
    {
      label: "Variación 1 año",
      value:
        change1y !== null
          ? `${change1y >= 0 ? "+" : ""}${change1y.toFixed(2)}%`
          : "—",
      sub: ccl1y ? `vs ${formatCCL(ccl1y)}` : "Sin datos",
      change: change1y,
    },
  ];

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Historial CCL"
        description="Contado con Liquidación"
        actions={<ImportButton />}
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        {/* KPI row */}
        <section className="animate-fade-up grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map(({ label, value, sub, change }) => (
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
                {change !== null && change >= 0 && (
                  <ArrowUpRight className="size-4 text-destructive shrink-0" />
                )}
                {change !== null && change < 0 && (
                  <ArrowDownRight className="size-4 text-emerald-500 shrink-0" />
                )}
                <span
                  className={`text-xl font-bold font-mono tabular-nums leading-none ${
                    change === null
                      ? "text-foreground"
                      : change >= 0
                      ? "text-destructive"
                      : "text-emerald-500"
                  }`}
                >
                  {value}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full shrink-0 bg-chart-1/50" />
                <span className="text-xs text-muted-foreground">
                  {label === "CCL Actual" ? "más reciente" : "del período"}
                </span>
              </div>
            </div>
          ))}
        </section>

        <Separator className="opacity-30" />

        {/* Chart */}
        <section
          className="animate-fade-up flex flex-col gap-4"
          style={{ animationDelay: "100ms" }}
        >
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Evolución del CCL
            {snapshots.length > 0 && " · Overlay Portfolio USD"}
          </p>
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <CCLChart rates={rates} snapshots={snapshots} />
          </div>
        </section>

        <Separator className="opacity-30" />

        {/* Timeline */}
        <section
          className="animate-fade-up flex flex-col gap-3"
          style={{ animationDelay: "200ms" }}
        >
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Registros recientes ({rates.length} total)
          </p>
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="divide-y divide-border">
              {[...rates]
                .reverse()
                .slice(0, 30)
                .map((r, i, arr) => {
                  const prev = arr[i + 1];
                  const change = prev
                    ? ((r.ccl - prev.ccl) / prev.ccl) * 100
                    : null;
                  const pos = change !== null && change >= 0;

                  return (
                    <div
                      key={r.date instanceof Date ? r.date.toISOString() : String(r.date)}
                      className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="size-2 rounded-full bg-chart-1/50 shrink-0" />
                        <span className="text-sm font-mono text-foreground">
                          {formatDate(r.date)}
                        </span>
                        {r.source && (
                          <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                            {r.source}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-mono tabular-nums text-foreground">
                          {formatCCL(r.ccl)}
                        </span>
                        {change !== null && (
                          <span
                            className={`text-xs font-mono tabular-nums ${
                              pos ? "text-destructive" : "text-emerald-500"
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
            {rates.length > 30 && (
              <div className="px-5 py-3 text-center text-xs text-muted-foreground border-t border-border">
                Mostrando los últimos 30 registros de {rates.length} totales
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
