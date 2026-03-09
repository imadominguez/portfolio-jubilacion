"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvExportButtonProps {
  href: string;
  label?: string;
}

export function CsvExportButton({ href, label = "Exportar CSV" }: CsvExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      onClick={() => window.open(href, "_blank")}
    >
      <Download className="size-3.5" />
      {label}
    </Button>
  );
}
