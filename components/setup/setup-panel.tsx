"use client";

import { useState } from "react";
import { ImportCsvSheet } from "@/components/snapshots/import-csv-sheet";
import { SetupChecklist } from "@/components/setup/setup-checklist";
import { WelcomeWizard } from "@/components/setup/welcome-wizard";
import type { SetupStatus } from "@/lib/setup-status";

type SetupPanelProps = {
  status: SetupStatus;
  /** Sólo muestra el checklist si no está todo completo. */
  showChecklist?: boolean;
};

/**
 * Conecta el wizard de bienvenida, el checklist de puesta en marcha y el
 * import de snapshot en un único punto, compartiendo una sola instancia del
 * sheet de importación.
 */
export function SetupPanel({ status, showChecklist = true }: SetupPanelProps) {
  const [wizardOpen, setWizardOpen] = useState(
    status.onboarding.shouldShowWizard
  );
  const [importOpen, setImportOpen] = useState(false);

  const openSnapshotImport = () => setImportOpen(true);

  return (
    <>
      {showChecklist && !status.allDone && (
        <SetupChecklist status={status} onImportSnapshot={openSnapshotImport} />
      )}

      <WelcomeWizard
        status={status}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onRequestSnapshotImport={openSnapshotImport}
      />

      <ImportCsvSheet open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
