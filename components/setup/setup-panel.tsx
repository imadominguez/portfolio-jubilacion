"use client";

import { useState, useSyncExternalStore } from "react";
import { ImportCsvSheet } from "@/components/snapshots/import-csv-sheet";
import { SetupChecklist } from "@/components/setup/setup-checklist";
import { WelcomeWizard } from "@/components/setup/welcome-wizard";
import type { SetupStatus } from "@/lib/setup-status";

type SetupPanelProps = {
  status: SetupStatus;
  /** Sólo muestra el checklist si no está todo completo. */
  showChecklist?: boolean;
  /** El wizard sólo se auto-abre en el dashboard, no en `/datos`. */
  showWizard?: boolean;
};

// "Más tarde" posterga el wizard por la sesión del navegador. Es una
// conveniencia de presentación por pestaña: si el storage no está disponible,
// el wizard vuelve a aparecer, que es el comportamiento seguro.
const SNOOZE_KEY = "onboarding-wizard-snoozed";

function isSnoozed(): boolean {
  try {
    return sessionStorage.getItem(SNOOZE_KEY) === "1";
  } catch {
    return false;
  }
}

function snooze(): void {
  try {
    sessionStorage.setItem(SNOOZE_KEY, "1");
  } catch {
    // Sin storage el wizard reaparece en la próxima visita; no es un error.
  }
}

// sessionStorage no emite eventos dentro de la misma pestaña: no hay a qué
// suscribirse. Cerrar el wizard se refleja con estado local.
const subscribeNoop = () => () => {};

/**
 * Conecta el wizard de bienvenida, el checklist de puesta en marcha y el
 * import de snapshot en un único punto, compartiendo una sola instancia del
 * sheet de importación.
 */
export function SetupPanel({
  status,
  showChecklist = true,
  showWizard = true,
}: SetupPanelProps) {
  // En el servidor se asume postergado: el wizard se abre recién al hidratar,
  // sin mismatch de markup.
  const snoozed = useSyncExternalStore(subscribeNoop, isSnoozed, () => true);
  const [closedHere, setClosedHere] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const wizardOpen =
    showWizard && status.onboarding.shouldShowWizard && !snoozed && !closedHere;

  function handleWizardOpenChange(open: boolean) {
    if (open) return;
    snooze();
    setClosedHere(true);
  }

  const openSnapshotImport = () => setImportOpen(true);

  return (
    <>
      {showChecklist && !status.allDone && (
        <SetupChecklist status={status} onImportSnapshot={openSnapshotImport} />
      )}

      {showWizard && (
        <WelcomeWizard
          status={status}
          open={wizardOpen}
          onOpenChange={handleWizardOpenChange}
          onRequestSnapshotImport={openSnapshotImport}
        />
      )}

      <ImportCsvSheet open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
