import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { GlossaryKey } from "@/lib/glossary";
import { formatARS, formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DashboardKpiStripProps {
  // Rendimiento vs el snapshot anterior, sin aportes; null con un solo snapshot.
  period: { pct: number; gainArs: number; sinceLabel: string } | null;
  // P&L no realizado contra el PPM: al precio del snapshot y con los precios del día.
  unrealized: { snapshotArs: number; todayArs: number | null } | null;
  // Ganancia real en USD (ver /real-gains): apreciación del subyacente + efecto CCL.
  realGain: { usd: number; pct: number | null; appreciationUsd: number | null; cclUsd: number | null } | null;
  dividendsUsd: number;
}

type Kpi = {
  label: string;
  value: string;
  sub: string | null;
  tone: "positive" | "negative" | null;
  glossary?: GlossaryKey;
};

function signedARS(v: number) {
  return `${v >= 0 ? "+" : ""}${formatARS(v)}`;
}
function signedUSD(v: number) {
  return `${v >= 0 ? "+" : ""}${formatUSD(v)}`;
}
const toneOf = (v: number) => (v >= 0 ? "positive" : "negative");

// Las cuatro métricas que cambian de una semana a otra, en una sola superficie
// dividida por líneas finas: sin tarjetas sueltas ni líneas de estado de relleno.
export function DashboardKpiStrip({ period, unrealized, realGain, dividendsUsd }: DashboardKpiStripProps) {
  const kpis: Kpi[] = [];

  if (period) {
    kpis.push({
      label: "Desde el snapshot anterior",
      value: formatPct(period.pct, { signed: true }),
      sub: `${signedARS(period.gainArs)} sin aportes · ${period.sinceLabel}`,
      tone: toneOf(period.pct),
    });
  }
  if (unrealized) {
    kpis.push({
      label: "Ganancia latente",
      value: signedARS(unrealized.snapshotArs),
      sub: unrealized.todayArs !== null ? `Con precios de hoy: ${signedARS(unrealized.todayArs)}` : "Precio del snapshot contra tu PPM",
      tone: toneOf(unrealized.snapshotArs),
      glossary: "pnl",
    });
  }
  if (realGain) {
    const parts = [
      realGain.appreciationUsd !== null ? `acciones ${signedUSD(realGain.appreciationUsd)}` : null,
      realGain.cclUsd !== null ? `CCL ${signedUSD(realGain.cclUsd)}` : null,
    ].filter(Boolean);
    kpis.push({
      label: "Ganancia real en dólares",
      value: signedUSD(realGain.usd),
      sub: parts.length ? parts.join(" · ") : null,
      tone: toneOf(realGain.usd),
    });
  }
  kpis.push({
    label: "Dividendos cobrados",
    value: formatUSD(dividendsUsd),
    sub: "Desde la primera importación",
    tone: null,
  });

  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-2xl border border-border bg-border grid-cols-1 sm:grid-cols-2",
        kpis.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}
    >
      {kpis.map((k) => (
        <div key={k.label} className="flex min-w-0 flex-col gap-1.5 bg-card px-5 py-4">
          <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {k.label}
            {k.glossary && <InfoTooltip term={k.glossary} />}
          </dt>
          <dd
            className={cn(
              "font-mono text-xl font-semibold tabular-nums",
              k.tone === "positive" ? "text-success" : k.tone === "negative" ? "text-destructive" : "text-foreground"
            )}
          >
            {k.value}
          </dd>
          {k.sub && <dd className="text-xs text-muted-foreground">{k.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}
