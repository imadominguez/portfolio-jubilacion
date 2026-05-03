"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { FileText, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportButtonsProps {
  snapshotId: string;
}

export function ExportButtons({ snapshotId }: ExportButtonsProps) {
  const [isPending, startTransition] = useTransition();

  function handlePrint() {
    const url = `/api/export/snapshot/${snapshotId}`;
    const win = window.open(url, "_blank");
    if (win) {
      win.onload = () => win.print();
    }
  }

  function handlePdfExport() {
    startTransition(() => {
      const url = `/api/export/pdf/${snapshotId}`;
      window.open(url, "_blank");
      toast.success("Generando PDF…");
    });
  }

  function handleCsvExport() {
    startTransition(() => {
      const url = `/api/export/snapshot/${snapshotId}?format=csv`;
      window.open(url, "_blank");
      toast.success("Descarga iniciada");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={isPending}>
          <Download className="size-3.5" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs">
        <DropdownMenuItem onClick={handlePdfExport} className="gap-2 text-xs">
          <FileDown className="size-3.5" />
          Descargar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint} className="gap-2 text-xs">
          <FileText className="size-3.5" />
          Imprimir / Vista previa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCsvExport} className="gap-2 text-xs">
          <Download className="size-3.5" />
          Descargar CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
