import type { ElementType } from "react";

interface KpiCardProps {
  label: string;
  sub: string;
  value: string;
  pct?: string | null;
  positive: boolean | null;
  icon?: ElementType;
  delay?: number;
}

export function KpiCard({
  label,
  sub,
  value,
  pct,
  positive,
  icon: Icon,
  delay,
}: KpiCardProps) {
  const valueColor =
    positive === true
      ? "text-success"
      : positive === false
        ? "text-destructive"
        : "text-foreground";

  return (
    <div
      className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 animate-fade-up"
      style={{ animationDelay: delay ? `${delay}ms` : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
        {Icon && <Icon className="size-4 text-muted-foreground/40 shrink-0 mt-0.5" />}
      </div>
      <div className="flex flex-col gap-1">
        <span className={`text-2xl font-bold font-mono tabular-nums leading-none ${valueColor}`}>
          {value}
        </span>
        {pct !== undefined && pct !== null && (
          <span className={`text-xs font-mono tabular-nums ${valueColor}`}>{pct}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`size-2 rounded-full shrink-0 ${positive === true
            ? "bg-success"
            : positive === false
              ? "bg-destructive"
              : "bg-muted-foreground/30"
            }`}
        />
        <span className="text-xs text-muted-foreground">
          {positive === true ? "ganancia" : positive === false ? "pérdida" : "neutro"}
        </span>
      </div>
    </div>
  );
}
