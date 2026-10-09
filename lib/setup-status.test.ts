import { describe, expect, it } from "vitest";
import {
  deriveOnboardingState,
  deriveSetupStatus,
  findMissingAssetTickers,
  type SetupInput,
} from "./setup-status";

const onboarding = deriveOnboardingState(null);

function baseInput(overrides: Partial<SetupInput> = {}): SetupInput {
  return {
    hasSnapshot: false,
    latestSnapshotTickers: [],
    assets: [],
    transactionCount: 0,
    cclHistoryCount: 0,
    stockHistoryCount: 0,
    hasRetirementSettings: false,
    canManageAssets: true,
    onboarding,
    ...overrides,
  };
}

describe("findMissingAssetTickers", () => {
  it("devuelve los tickers sin asset listo", () => {
    const missing = findMissingAssetTickers(
      ["AAPL", "MSFT", "KO"],
      [
        { ticker: "AAPL", cedearRatio: 10, underlyingTicker: "AAPL" },
        { ticker: "MSFT", cedearRatio: 0, underlyingTicker: "MSFT" },
      ]
    );
    expect(missing).toEqual(["MSFT", "KO"]);
  });

  it("considera completo un asset con ratio y subyacente", () => {
    const missing = findMissingAssetTickers(
      ["ko"],
      [{ ticker: "KO", cedearRatio: 5, underlyingTicker: "KO" }]
    );
    expect(missing).toEqual([]);
  });

  it("no duplica tickers repetidos", () => {
    const missing = findMissingAssetTickers(["NVDA", "nvda"], []);
    expect(missing).toEqual(["NVDA"]);
  });
});

describe("deriveSetupStatus", () => {
  it("usuario nuevo: sólo snapshot requerido pendiente y wizard visible", () => {
    const status = deriveSetupStatus(baseInput());
    expect(status.completedCount).toBe(0);
    expect(status.allRequiredDone).toBe(false);
    expect(status.allDone).toBe(false);
    expect(status.onboarding.shouldShowWizard).toBe(true);
    expect(status.steps.find((s) => s.id === "snapshot")?.done).toBe(false);
    expect(status.steps.find((s) => s.id === "assets")?.done).toBe(false);
  });

  it("snapshot + assets completos habilitan allRequiredDone", () => {
    const status = deriveSetupStatus(
      baseInput({
        hasSnapshot: true,
        latestSnapshotTickers: ["AAPL", "KO"],
        assets: [
          { ticker: "AAPL", cedearRatio: 10, underlyingTicker: "AAPL" },
          { ticker: "KO", cedearRatio: 5, underlyingTicker: "KO" },
        ],
      })
    );
    expect(status.allRequiredDone).toBe(true);
    expect(status.allDone).toBe(false);
    expect(status.missingAssetTickers).toEqual([]);
  });

  it("snapshot sin assets deja el paso assets pendiente", () => {
    const status = deriveSetupStatus(
      baseInput({ hasSnapshot: true, latestSnapshotTickers: ["AAPL"] })
    );
    expect(status.missingAssetTickers).toEqual(["AAPL"]);
    expect(status.steps.find((s) => s.id === "assets")?.done).toBe(false);
    expect(status.allRequiredDone).toBe(false);
  });

  it("para un USER el paso assets es informativo y no bloquea", () => {
    const status = deriveSetupStatus(
      baseInput({
        canManageAssets: false,
        hasSnapshot: true,
        latestSnapshotTickers: ["AAPL"],
      })
    );
    const assets = status.steps.find((s) => s.id === "assets");
    expect(assets?.actionable).toBe(false);
    expect(assets?.required).toBe(false);
    expect(status.allRequiredDone).toBe(true);
    expect(status.totalCount).toBe(4);
    expect(status.missingAssetTickers).toEqual(["AAPL"]);
  });

  it("un USER puede llegar a allDone aunque falten assets", () => {
    const status = deriveSetupStatus(
      baseInput({
        canManageAssets: false,
        hasSnapshot: true,
        latestSnapshotTickers: ["AAPL"],
        transactionCount: 1,
        cclHistoryCount: 1,
        stockHistoryCount: 1,
        hasRetirementSettings: true,
      })
    );
    expect(status.allDone).toBe(true);
    expect(status.completedCount).toBe(status.totalCount);
  });

  it("históricos requieren CCL y precios de acciones", () => {
    const onlyCcl = deriveSetupStatus(
      baseInput({ cclHistoryCount: 10, stockHistoryCount: 0 })
    );
    expect(onlyCcl.steps.find((s) => s.id === "historicals")?.done).toBe(false);

    const both = deriveSetupStatus(
      baseInput({ cclHistoryCount: 10, stockHistoryCount: 3 })
    );
    expect(both.steps.find((s) => s.id === "historicals")?.done).toBe(true);
  });

  it("preferencias se completan con el plan de retiro", () => {
    expect(
      deriveSetupStatus(baseInput({ hasRetirementSettings: true })).steps.find(
        (s) => s.id === "preferences"
      )?.done
    ).toBe(true);
    expect(
      deriveSetupStatus(baseInput()).steps.find((s) => s.id === "preferences")
        ?.done
    ).toBe(false);
  });

  it("allDone cuando todos los pasos están completos", () => {
    const status = deriveSetupStatus(
      baseInput({
        hasSnapshot: true,
        latestSnapshotTickers: ["AAPL"],
        assets: [{ ticker: "AAPL", cedearRatio: 10, underlyingTicker: "AAPL" }],
        transactionCount: 1,
        cclHistoryCount: 1,
        stockHistoryCount: 1,
        hasRetirementSettings: true,
      })
    );
    expect(status.allDone).toBe(true);
    expect(status.completedCount).toBe(status.totalCount);
  });
});

describe("deriveOnboardingState", () => {
  it("muestra el wizard si nunca se completó ni omitió", () => {
    expect(deriveOnboardingState(null).shouldShowWizard).toBe(true);
  });

  it("no muestra el wizard si fue completado", () => {
    const state = deriveOnboardingState({
      onboardingCompletedAt: new Date(),
      onboardingDismissedAt: null,
      lastStep: null,
    });
    expect(state.shouldShowWizard).toBe(false);
  });

  it("no muestra el wizard si fue omitido", () => {
    const state = deriveOnboardingState({
      onboardingCompletedAt: null,
      onboardingDismissedAt: new Date(),
      lastStep: "assets",
    });
    expect(state.shouldShowWizard).toBe(false);
    expect(state.lastStep).toBe("assets");
  });
});
