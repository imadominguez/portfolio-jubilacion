"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const THEMES = ["system", "light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const LABELS: Record<Theme, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "light") return <Sun className="size-3.5" />;
  if (theme === "dark") return <Moon className="size-3.5" />;
  return <Monitor className="size-3.5" />;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-7 opacity-0" disabled>
        <Moon className="size-3.5" />
      </Button>
    );
  }

  const current = (theme as Theme) ?? "system";

  function cycleTheme() {
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={cycleTheme}
        >
          <ThemeIcon theme={current} />
          <span className="sr-only">Cambiar tema ({LABELS[current]})</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {LABELS[current]}
      </TooltipContent>
    </Tooltip>
  );
}
