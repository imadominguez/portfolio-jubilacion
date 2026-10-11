import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

// Piezas comunes de la anatomía de página (DESIGN.md §6.10). El título de la
// página vive en SiteHeader; acá van la bajada, los títulos de sección y las
// métricas, para que todas las pantallas se lean igual.

export const PAGE_MAIN = "flex-1 w-full max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8";

// Bajada de la página: qué muestra y cómo leerla. Sin kicker encima.
export function PageIntro({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("max-w-2xl text-sm leading-relaxed text-muted-foreground", className)}>{children}</p>;
}

export function SectionHeading({
  id,
  title,
  description,
  actions,
  as: Tag = "h2",
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <Tag id={id} className="text-base font-semibold text-foreground">
          {title}
        </Tag>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export type Stat = {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "positive" | "negative" | "warning" | null;
  glossary?: GlossaryKey;
};

const TONE: Record<NonNullable<Stat["tone"]>, string> = {
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-warning",
};

// Métricas en una sola superficie con divisiones finas, en lugar de tarjetas
// sueltas. Columnas: 2 en tablet, hasta 4 (o las que haya) en escritorio.
export function StatGrid({ stats, className }: { stats: Stat[]; className?: string }) {
  const lg = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" }[stats.length] ?? "lg:grid-cols-4";
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border",
        stats.length > 1 && "sm:grid-cols-2",
        lg,
        className
      )}
    >
      {stats.map((s, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-1.5 bg-card px-5 py-4">
          <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {s.label}
            {s.glossary && <InfoTooltip term={s.glossary} />}
          </dt>
          <dd className={cn("font-mono text-xl font-semibold tabular-nums", s.tone ? TONE[s.tone] : "text-foreground")}>
            {s.value}
          </dd>
          {s.sub && <dd className="text-xs text-muted-foreground">{s.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}
