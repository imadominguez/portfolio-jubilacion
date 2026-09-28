import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { GlossaryKey } from "@/lib/glossary";
import { formatARS, formatUSD } from "@/lib/format";

interface DashboardKpiStripProps {
  totalValueUsd: number | null;
  ccl: number | null;
  positionCount: number;
  gainPct: number | null;
  isPositive: boolean;
  totalUnrealizedPnlArs: number | null;
  unrealizedIsPositive: boolean;
  totalDividendsUsd: number;
}

export function DashboardKpiStrip({
  totalValueUsd,
  ccl,
  positionCount,
  gainPct,
  isPositive,
  totalUnrealizedPnlArs,
  unrealizedIsPositive,
  totalDividendsUsd,
}: DashboardKpiStripProps) {
  const kpis: {
    label: string;
    sub: string;
    value: string;
    status: string;
    accent: boolean | null;
    glossary: GlossaryKey | undefined;
  }[] = [
    {
      label: "Equivalente USD",
      sub: "Tipo de cambio CCL",
      value: totalValueUsd ? formatUSD(totalValueUsd) : "—",
      status: "calculado",
      accent: null,
      glossary: "ccl",
    },
    {
      label: "Tipo de cambio",
      sub: "CCL implícito",
      value: ccl ? formatARS(ccl) : "—",
      status: "del snapshot",
      accent: null,
      glossary: "ccl",
    },
    {
      label: "Posiciones",
      sub: "CEDEARs activos",
      value: `${positionCount}`,
      status: "activos",
      accent: null,
      glossary: undefined,
    },
  ];

  if (gainPct !== null) {
    kpis.push({
      label: "Rendimiento",
      sub: "vs snapshot anterior",
      value: `${isPositive ? "+" : ""}${gainPct.toFixed(2)}%`,
      status: "vs anterior",
      accent: isPositive,
      glossary: "cagr",
    });
  }

  if (totalUnrealizedPnlArs !== null) {
    kpis.push({
      label: "P&L no realizado",
      sub: "precio actual vs PPM",
      value: `${unrealizedIsPositive ? "+" : ""}${formatARS(totalUnrealizedPnlArs)}`,
      status: unrealizedIsPositive ? "ganancia latente" : "pérdida latente",
      accent: unrealizedIsPositive,
      glossary: "pnl",
    });
  }

  if (totalDividendsUsd > 0) {
    kpis.push({
      label: "Dividendos",
      sub: "total cobrado",
      value: formatUSD(totalDividendsUsd),
      status: "acumulado USD",
      accent: true,
      glossary: undefined,
    });
  }

  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 animate-fade-up"
      style={{ animationDelay: "80ms" }}
    >
      {kpis.map(({ label, sub, value, status, accent, glossary }) => (
        <div
          key={label}
          className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              {label}
              {glossary && <InfoTooltip term={glossary} />}
            </span>
            <span className="text-xs text-muted-foreground">{sub}</span>
          </div>
          <span
            className={`text-xl font-bold font-mono tabular-nums leading-none ${
              accent === true
                ? "text-success"
                : accent === false
                  ? "text-destructive"
                  : "text-foreground"
            }`}
          >
            {value}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full shrink-0 ${
                accent === false ? "bg-destructive" : "bg-success"
              }`}
            />
            <span className="text-xs text-muted-foreground">{status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
