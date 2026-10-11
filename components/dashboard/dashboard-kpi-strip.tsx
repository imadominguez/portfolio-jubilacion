import { StatGrid, type Stat } from "@/components/layout/page-parts";
import { formatARS, formatPct, formatUSD } from "@/lib/format";

interface DashboardKpiStripProps {
  // Rendimiento vs el snapshot anterior, sin aportes; null con un solo snapshot.
  period: { pct: number; gainArs: number; sinceLabel: string } | null;
  // P&L no realizado contra el PPM: al precio del snapshot y con los precios del día.
  unrealized: { snapshotArs: number; todayArs: number | null } | null;
  // Ganancia real en USD (ver /real-gains): apreciación del subyacente + efecto CCL.
  realGain: { usd: number; pct: number | null; appreciationUsd: number | null; cclUsd: number | null } | null;
  dividendsUsd: number;
}

function signedARS(v: number) {
  return `${v >= 0 ? "+" : ""}${formatARS(v)}`;
}
function signedUSD(v: number) {
  return `${v >= 0 ? "+" : ""}${formatUSD(v)}`;
}
const toneOf = (v: number) => (v >= 0 ? "positive" : "negative");

// Las cuatro métricas que cambian de una semana a otra.
export function DashboardKpiStrip({ period, unrealized, realGain, dividendsUsd }: DashboardKpiStripProps) {
  const stats: Stat[] = [];

  if (period) {
    stats.push({
      label: "Desde el snapshot anterior",
      value: formatPct(period.pct, { signed: true }),
      sub: `${signedARS(period.gainArs)} sin aportes · ${period.sinceLabel}`,
      tone: toneOf(period.pct),
    });
  }
  if (unrealized) {
    stats.push({
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
    stats.push({
      label: "Ganancia real en dólares",
      value: signedUSD(realGain.usd),
      sub: parts.length ? parts.join(" · ") : undefined,
      tone: toneOf(realGain.usd),
    });
  }
  stats.push({ label: "Dividendos cobrados", value: formatUSD(dividendsUsd), sub: "Desde la primera importación" });

  return <StatGrid stats={stats} />;
}
