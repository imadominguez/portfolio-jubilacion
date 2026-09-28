// ---------------------------------------------------------------------------
// Estado de "puesta en marcha" (setup) del usuario.
//
// Este módulo es PURO: no toca Prisma. Recibe los datos crudos y deriva el
// estado de cada paso para el checklist y el wizard de onboarding. La lectura
// de la base vive en `app/actions/setup.ts`.
// ---------------------------------------------------------------------------

export type SetupStepId =
  | "snapshot"
  | "assets"
  | "transactions"
  | "historicals"
  | "preferences";

export type SetupStep = {
  id: SetupStepId;
  label: string;
  description: string;
  /** Si es requerido, el checklist no se considera completo hasta cumplirlo. */
  required: boolean;
  done: boolean;
  /** Ruta donde se resuelve el paso. */
  href: string;
  /** Texto del call to action cuando el paso está pendiente. */
  ctaLabel: string;
};

export type OnboardingState = {
  completedAt: Date | null;
  dismissedAt: Date | null;
  lastStep: string | null;
  /** El wizard de bienvenida debe mostrarse al entrar al dashboard. */
  shouldShowWizard: boolean;
};

export type SetupStatus = {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  allRequiredDone: boolean;
  allDone: boolean;
  /** Tickers del último snapshot que todavía no tienen Asset configurado. */
  missingAssetTickers: string[];
  onboarding: OnboardingState;
};

export type SetupAssetInput = {
  ticker: string;
  cedearRatio: number;
  underlyingTicker: string | null;
};

export type SetupInput = {
  hasSnapshot: boolean;
  /** Tickers de las posiciones del snapshot más reciente. */
  latestSnapshotTickers: string[];
  assets: SetupAssetInput[];
  transactionCount: number;
  cclHistoryCount: number;
  stockHistoryCount: number;
  targetAllocationCount: number;
  hasRetirementSettings: boolean;
  onboarding: OnboardingState;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Tickers del snapshot sin un Asset completo (ratio > 0 y subyacente definido).
 * El matching es por string normalizado porque `Position.ticker` es texto libre.
 */
export function findMissingAssetTickers(
  snapshotTickers: string[],
  assets: SetupAssetInput[]
): string[] {
  const ready = new Set(
    assets
      .filter((a) => a.cedearRatio > 0 && !!a.underlyingTicker?.trim())
      .map((a) => normalizeTicker(a.ticker))
  );

  const missing: string[] = [];
  const seen = new Set<string>();
  for (const ticker of snapshotTickers) {
    const normalized = normalizeTicker(ticker);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    if (!ready.has(normalized)) missing.push(normalized);
  }
  return missing;
}

export function deriveSetupStatus(input: SetupInput): SetupStatus {
  const missingAssetTickers = input.hasSnapshot
    ? findMissingAssetTickers(input.latestSnapshotTickers, input.assets)
    : [];

  const hasTickers = input.hasSnapshot && input.latestSnapshotTickers.length > 0;
  const assetsDone = hasTickers && missingAssetTickers.length === 0;

  const historicalsDone =
    input.cclHistoryCount > 0 && input.stockHistoryCount > 0;

  const preferencesDone =
    input.targetAllocationCount > 0 || input.hasRetirementSettings;

  const steps: SetupStep[] = [
    {
      id: "snapshot",
      label: "Importar tu primer snapshot",
      description:
        "El CSV de Portfolio de Cocos Capital con el estado de tu cartera.",
      required: true,
      done: input.hasSnapshot,
      href: "/",
      ctaLabel: "Importar snapshot",
    },
    {
      id: "assets",
      label: "Completar los datos de tus activos",
      description:
        "Ratio CEDEAR, subyacente, sector y país para habilitar USD en vivo, Concentración y Ganancia Real.",
      required: true,
      done: assetsDone,
      href: "/assets",
      ctaLabel: "Completar activos",
    },
    {
      id: "transactions",
      label: "Registrar tus compras y ventas",
      description:
        "El CSV de Actividad de Cocos Capital. Habilita el precio promedio de compra (PPM) y el P&L.",
      required: false,
      done: input.transactionCount > 0,
      href: "/transactions",
      ctaLabel: "Importar movimientos",
    },
    {
      id: "historicals",
      label: "Cargar datos históricos",
      description:
        "CCL y precios de acciones desde tu primera compra para calcular la Ganancia Real en USD.",
      required: false,
      done: historicalsDone,
      href: "/real-gains",
      ctaLabel: "Cargar históricos",
    },
    {
      id: "preferences",
      label: "Definir objetivos y plan de retiro",
      description:
        "Asignación objetivo por activo y parámetros de tu calculadora de jubilación.",
      required: false,
      done: preferencesDone,
      href: "/rebalance",
      ctaLabel: "Configurar objetivos",
    },
  ];

  const requiredSteps = steps.filter((s) => s.required);
  const completedCount = steps.filter((s) => s.done).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    allRequiredDone: requiredSteps.every((s) => s.done),
    allDone: steps.every((s) => s.done),
    missingAssetTickers,
    onboarding: input.onboarding,
  };
}

export function deriveOnboardingState(setup: {
  onboardingCompletedAt: Date | null;
  onboardingDismissedAt: Date | null;
  lastStep: string | null;
} | null): OnboardingState {
  const completedAt = setup?.onboardingCompletedAt ?? null;
  const dismissedAt = setup?.onboardingDismissedAt ?? null;
  return {
    completedAt,
    dismissedAt,
    lastStep: setup?.lastStep ?? null,
    shouldShowWizard: !completedAt && !dismissedAt,
  };
}
