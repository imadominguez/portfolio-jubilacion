import { formatUSD } from "@/lib/format";
import type { RealGainsSummary } from "@/lib/real-gains-data";
import { fmtPct, signColor } from "./real-gains-helpers";

export function BreakdownBar({ summary }: { summary: RealGainsSummary }) {
  const { totalGainUsdAppreciation, totalGainUsdCclImpact, totalGainUsdReal } = summary;

  if (totalGainUsdReal === null || totalGainUsdAppreciation === null) return null;

  const total = Math.abs(totalGainUsdReal) || 1;
  const appPct = Math.abs(totalGainUsdAppreciation) / total;
  const cclPct = Math.abs(totalGainUsdCclImpact ?? 0) / total;

  const appIsPositive = (totalGainUsdAppreciation ?? 0) >= 0;
  const cclIsPositive = (totalGainUsdCclImpact ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold text-foreground">
          Desglose de la ganancia en USD
        </p>
        <p className="text-xs text-muted-foreground">
          Total:{" "}
          <span className={`font-mono font-semibold ${signColor(totalGainUsdReal)}`}>
            {formatUSD(totalGainUsdReal)}
          </span>
        </p>
      </div>

      {/* Barra */}
      <div className="flex h-7 rounded-lg overflow-hidden gap-px">
        <div
          className={`flex items-center justify-center text-[10px] font-semibold transition-all ${appIsPositive ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"
            }`}
          style={{ width: `${(appPct * 100).toFixed(1)}%`, minWidth: appPct > 0 ? "2px" : "0" }}
          title={`Apreciación acciones: ${formatUSD(totalGainUsdAppreciation)}`}
        >
          {appPct > 0.15 && `${(appPct * 100).toFixed(0)}%`}
        </div>
        <div
          className={`flex items-center justify-center text-[10px] font-semibold transition-all ${cclIsPositive ? "bg-info text-info-foreground" : "bg-destructive text-destructive-foreground"
            }`}
          style={{
            width: `${(cclPct * 100).toFixed(1)}%`,
            minWidth: cclPct > 0 ? "2px" : "0",
          }}
          title={`Impacto CCL: ${formatUSD(totalGainUsdCclImpact ?? 0)}`}
        >
          {cclPct > 0.15 && `${(cclPct * 100).toFixed(0)}%`}
        </div>
      </div>

      {/* Leyenda */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2.5 rounded-full shrink-0 ${appIsPositive ? "bg-success" : "bg-warning"}`}
          />
          <div className="flex flex-col gap-0">
            <span className="text-xs font-medium text-foreground">Apreciación acciones</span>
            <span className={`text-xs font-mono tabular-nums ${signColor(totalGainUsdAppreciation)}`}>
              {formatUSD(totalGainUsdAppreciation)} ({fmtPct(summary.totalGainPctUsdAppreciation)})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2.5 rounded-full shrink-0 ${cclIsPositive ? "bg-info" : "bg-destructive"}`}
          />
          <div className="flex flex-col gap-0">
            <span className="text-xs font-medium text-foreground">Impacto CCL</span>
            <span
              className={`text-xs font-mono tabular-nums ${signColor(totalGainUsdCclImpact)}`}
            >
              {formatUSD(totalGainUsdCclImpact ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
