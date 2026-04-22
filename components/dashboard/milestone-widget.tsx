import { CheckCircle2, Target } from "lucide-react";
import type { MilestoneRow } from "@/app/actions/milestones";

interface MilestoneWidgetProps {
  milestones: MilestoneRow[];
  currentValueUsd: number;
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MilestoneWidget({
  milestones,
  currentValueUsd,
}: MilestoneWidgetProps) {
  const reached = milestones.filter((m) => m.reached);
  const nextMilestone = milestones.find((m) => !m.reached);

  if (milestones.length === 0) return null;

  const progressPct = nextMilestone
    ? Math.min((currentValueUsd / nextMilestone.targetValueUsd) * 100, 100)
    : 100;

  return (
    <div className="animate-fade-up" style={{ animationDelay: "350ms" }}>
      <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Hitos de jubilación
      </p>
      <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-4">
        {/* Reached badges */}
        {reached.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {reached.map((m) => (
              <div
                key={m.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-mono font-semibold"
              >
                <CheckCircle2 className="size-3.5 shrink-0" />
                {m.label}
              </div>
            ))}
          </div>
        )}

        {/* Next milestone progress */}
        {nextMilestone ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold text-foreground">
                  Próximo: {nextMilestone.label}
                </span>
              </div>
              <span className="text-sm font-mono font-bold tabular-nums text-foreground">
                {formatUSD(currentValueUsd)}{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  / {formatUSD(nextMilestone.targetValueUsd)}
                </span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Faltan{" "}
                <span className="font-mono font-semibold text-foreground">
                  {formatUSD(nextMilestone.targetValueUsd - currentValueUsd)}
                </span>
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-500">
                {progressPct.toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            ¡Todos los hitos alcanzados! 🎉
          </p>
        )}
      </div>
    </div>
  );
}
