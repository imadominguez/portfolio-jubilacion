import type { Metadata } from "next";
import { Suspense } from "react";
import { Activity } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/layout/site-header";
import { CCLChart } from "@/components/ccl/ccl-chart";
import { CclSkeleton } from "@/components/ccl/ccl-skeleton";
import { CclUpdateButton } from "@/components/exchange-rate/ccl-update-button";
import { getAllExchangeRates } from "@/app/actions/exchange-rate";
import { getAllSnapshotPoints } from "@/lib/portfolio-data";
import { formatDateMedium, formatARS, formatPct } from "@/lib/format";
import { PageIntro, StatGrid } from "@/components/layout/page-parts";

export const metadata: Metadata = { title: "Historial CCL" };

// El header entra al static shell; el historial y los snapshots del usuario se
// leen en request time y se streamean detrás del skeleton.
export default function CCLPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Historial CCL"
        description="Contado con Liquidación"
        actions={<CclUpdateButton />}
      />
      <Suspense fallback={<CclSkeleton />}>
        <CclContent />
      </Suspense>
    </div>
  );
}

async function CclContent() {
  const [rates, snapshots] = await Promise.all([
    getAllExchangeRates(),
    getAllSnapshotPoints(),
  ]);

  if (rates.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <Activity className="size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">
            Sin datos de CCL
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Actualizá el CCL para comenzar a registrar el historial. También
            podés cargar el histórico completo desde el Centro de Datos.
          </p>
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
            <CclUpdateButton />
          </div>
        </div>
      </main>
    );
  }

  // Después de las lecturas de request: con Cache Components, la hora no puede
  // leerse durante el prerender del shell.
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
      value: formatARS(cclNow),
      sub: formatDateMedium(latest.date),
      change: null,
    },
    {
      label: "Variación 1 mes",
      value: change1m !== null ? formatPct(change1m, { signed: true }) : "—",
      sub: ccl1m ? `vs ${formatARS(ccl1m)}` : "Sin datos",
      change: change1m,
    },
    {
      label: "Variación YTD",
      value:
        changeYTD !== null
          ? formatPct(changeYTD, { signed: true })
          : "—",
      sub: cclYTD ? `vs ${formatARS(cclYTD)}` : "Sin datos",
      change: changeYTD,
    },
    {
      label: "Variación 1 año",
      value:
        change1y !== null
          ? formatPct(change1y, { signed: true })
          : "—",
      sub: ccl1y ? `vs ${formatARS(ccl1y)}` : "Sin datos",
      change: change1y,
    },
  ];

  return (
    <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
      <PageIntro>
        Que el CCL suba es que el peso se devalúa: tus CEDEARs valen más en pesos, pero eso no es ganancia en
        dólares. Por eso las variaciones van sin color de ganancia o pérdida.
      </PageIntro>

      <StatGrid stats={kpis.map(({ label, value, sub }) => ({ label, value, sub }))} />

      <Separator className="opacity-30" />

      {/* Chart */}
      <section
        className="flex flex-col gap-4"
      >
        <h2 className="text-base font-semibold text-foreground">
          Evolución del CCL
          {snapshots.length > 0 && " · Overlay Portfolio USD"}
        </h2>
        <div className="rounded-xl border border-border bg-card shadow-sm p-5">
          <CCLChart rates={rates} snapshots={snapshots} />
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* Timeline */}
      <section
        className="flex flex-col gap-3"
      >
        <h2 className="text-base font-semibold text-foreground">
          Registros recientes ({rates.length} total)
        </h2>
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

                return (
                  <div
                    key={r.date instanceof Date ? r.date.toISOString() : String(r.date)}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-2 rounded-full bg-chart-1/50 shrink-0" />
                      <span className="text-sm font-mono text-foreground">
                        {formatDateMedium(r.date)}
                      </span>
                      {r.source && (
                        <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                          {r.source}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono tabular-nums text-foreground">
                        {formatARS(r.ccl)}
                      </span>
                      {change !== null && (
                        <span className="text-xs font-mono tabular-nums text-muted-foreground">
                          {formatPct(change, { signed: true })}
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
  );
}
