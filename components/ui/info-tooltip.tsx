"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

type InfoTooltipProps = {
  term: GlossaryKey;
  className?: string;
};

/** Ícono "?" con la definición del término del glosario. */
export function InfoTooltip({ term, className }: InfoTooltipProps) {
  const entry = GLOSSARY[term];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Qué es ${entry.term}`}
          className={cn(
            "inline-flex shrink-0 items-center text-muted-foreground/50 transition-colors hover:text-muted-foreground",
            className
          )}
        >
          <HelpCircle className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs font-semibold">{entry.term}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {entry.definition}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
