"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvExportButtonProps {
  href: string;
  label?: string;
  // En headers con varias acciones: solo el ícono por debajo de 2xl.
  compact?: boolean;
}

export function CsvExportButton({ href, label = "Exportar CSV", compact = false }: CsvExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      onClick={() => window.open(href, "_blank")}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
    >
      <Download className="size-3.5" />
      <span className={compact ? "hidden 2xl:inline" : undefined}>{label}</span>
    </Button>
  );
}
