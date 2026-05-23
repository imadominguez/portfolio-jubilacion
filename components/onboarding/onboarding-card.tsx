"use client";

import type { CardComponentProps } from "nextstepjs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="relative w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-border/80 bg-card/95 p-5 shadow-2xl backdrop-blur-sm animate-tour-card-in">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 bg-muted"
      >
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {arrow}

      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-start gap-3 min-w-0">
          {step.icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base leading-none">
              {step.icon}
            </span>
          ) : null}
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {step.title}
            </p>
            <div className="text-xs text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5">
              {step.content}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground/70">
              {currentStep + 1} / {totalSteps}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1 w-1 rounded-full transition-all duration-300",
                    index <= currentStep ? "bg-primary scale-100" : "bg-muted-foreground/25 scale-90"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {step.showSkip && skipTour ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={skipTour}
              >
                Omitir
              </Button>
            ) : null}
            {!isFirst ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={prevStep}
              >
                Anterior
              </Button>
            ) : null}
            {step.showControls !== false ? (
              <Button
                type="button"
                size="sm"
                className={cn("h-7 text-xs transition-transform active:scale-95", isLast && "min-w-[4.5rem]")}
                onClick={nextStep}
              >
                {isLast ? "Finalizar" : "Siguiente"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
