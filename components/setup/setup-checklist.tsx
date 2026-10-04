"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Info, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SetupStatus } from "@/lib/setup-status";

type SetupChecklistProps = {
  status: SetupStatus;
  /** Si se provee, el paso de snapshot abre el import en vez de navegar. */
  onImportSnapshot?: () => void;
  compact?: boolean;
  className?: string;
};

export function SetupChecklist({
  status,
  onImportSnapshot,
  compact = false,
  className,
}: SetupChecklistProps) {
  const pct = status.totalCount
    ? (status.completedCount / status.totalCount) * 100
    : 0;

  if (status.allDone) {
    return (
      <div
        className={cn(
          "rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 flex items-center gap-3",
          className
        )}
      >
        <PartyPopper className="size-4 text-emerald-500 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Configuración completa
          </p>
          <p className="text-xs text-muted-foreground">
            Ya tenés todo lo necesario para aprovechar el portfolio al máximo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-foreground">
              Puesta en marcha
            </p>
            <p className="text-xs text-muted-foreground">
              {status.completedCount} de {status.totalCount} pasos completados
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
            {Math.round(pct)}%
          </Badge>
        </div>
        <Progress value={pct} />
      </div>

      <ul className="border-t border-border/60 divide-y divide-border/40">
        {status.steps.map((step) => {
          const Icon = step.done ? CheckCircle2 : step.actionable ? Circle : Info;
          const showCta = !step.done && step.actionable;
          const useImport = step.id === "snapshot" && onImportSnapshot;

          return (
            <li
              key={step.id}
              className="px-5 py-3.5 flex items-start gap-3"
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 mt-0.5",
                  step.done ? "text-emerald-500" : "text-muted-foreground/40"
                )}
              />
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.done
                        ? "text-muted-foreground line-through decoration-muted-foreground/30"
                        : "text-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  {step.required && !step.done && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal text-amber-600 dark:text-amber-400 border-amber-500/30"
                    >
                      Requerido
                    </Badge>
                  )}
                  {!step.actionable && !step.done && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      Lo configura el administrador
                    </Badge>
                  )}
                </div>
                {!compact && !step.done && (
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </span>
                )}
              </div>

              {showCta &&
                (useImport ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 text-xs"
                    onClick={onImportSnapshot}
                  >
                    {step.ctaLabel}
                    <ArrowRight className="size-3" />
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 text-xs"
                  >
                    <Link href={step.href}>
                      {step.ctaLabel}
                      <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
