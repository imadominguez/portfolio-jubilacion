"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { ImportCsvSheet } from "./import-csv-sheet";

export function ImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => setOpen(true)}>
        <Upload className="size-3" data-icon="inline-start" />
        Importar CSV
      </Button>
      <ImportCsvSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
