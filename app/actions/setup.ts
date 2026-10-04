"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateSetup } from "@/lib/revalidate";
import { marketTags, userTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";
import {
  deriveOnboardingState,
  deriveSetupStatus,
  type SetupStatus,
} from "@/lib/setup-status";

export type SetupActionResult =
  | { success: true }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export async function getSetupStatus(): Promise<SetupStatus> {
  const session = await requireAuth();
  return cachedSetupStatus(session.user.id, isAdminRole(session.user.role));
}

// No se exporta: recibe el usuario ya resuelto de la sesión (ADR-0017). El
// checklist mira casi todos los dominios, de ahí la cantidad de tags.
async function cachedSetupStatus(
  userId: string,
  canManageAssets: boolean
): Promise<SetupStatus> {
  "use cache";
  cacheLife("hours");
  cacheTag(
    userTags.snapshots(userId),
    userTags.trades(userId),
    userTags.rebalance(userId),
    userTags.retirement(userId),
    userTags.setup(userId),
    marketTags.assets,
    marketTags.ccl,
    marketTags.historicalPrices
  );

  const [
    latestSnapshot,
    assets,
    transactionCount,
    cclHistoryCount,
    stockHistoryCount,
    targetAllocationCount,
    retirementSettings,
    setup,
  ] = await Promise.all([
    db.portfolioSnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotDate: "desc" },
      select: { positions: { select: { ticker: true } } },
    }),
    db.asset.findMany({
      select: { ticker: true, cedearRatio: true, underlyingTicker: true },
    }),
    db.transaction.count({ where: { userId } }),
    db.exchangeRate.count(),
    db.historicalPriceCache.count(),
    db.targetAllocation.count({ where: { userId } }),
    db.retirementSettings.findFirst({
      where: { userId },
      select: { id: true },
    }),
    db.userSetup.findUnique({ where: { userId } }),
  ]);

  const onboarding = deriveOnboardingState(setup);

  return deriveSetupStatus({
    hasSnapshot: latestSnapshot !== null,
    latestSnapshotTickers:
      latestSnapshot?.positions.map((p) => p.ticker) ?? [],
    assets: assets.map((a) => ({
      ticker: a.ticker,
      cedearRatio: Number(a.cedearRatio),
      underlyingTicker: a.underlyingTicker,
    })),
    transactionCount,
    cclHistoryCount,
    stockHistoryCount,
    targetAllocationCount,
    hasRetirementSettings: retirementSettings !== null,
    canManageAssets,
    onboarding,
  });
}

// ---------------------------------------------------------------------------
// Mutaciones del onboarding
// ---------------------------------------------------------------------------

async function upsertSetup(
  userId: string,
  data: {
    onboardingCompletedAt?: Date | null;
    onboardingDismissedAt?: Date | null;
    lastStep?: string | null;
  }
): Promise<void> {
  await db.userSetup.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function completeOnboarding(): Promise<SetupActionResult> {
  try {
    const session = await requireAuth();
    await upsertSetup(session.user.id, {
      onboardingCompletedAt: new Date(),
      onboardingDismissedAt: null,
    });
    revalidateSetup(session.user.id);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado.",
    };
  }
}

export async function dismissOnboarding(): Promise<SetupActionResult> {
  try {
    const session = await requireAuth();
    await upsertSetup(session.user.id, {
      onboardingDismissedAt: new Date(),
    });
    revalidateSetup(session.user.id);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado.",
    };
  }
}

export async function setOnboardingStep(step: string): Promise<SetupActionResult> {
  try {
    const session = await requireAuth();
    await upsertSetup(session.user.id, { lastStep: step });
    revalidateSetup(session.user.id);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado.",
    };
  }
}

export async function restartOnboarding(): Promise<SetupActionResult> {
  try {
    const session = await requireAuth();
    await upsertSetup(session.user.id, {
      onboardingCompletedAt: null,
      onboardingDismissedAt: null,
      lastStep: null,
    });
    revalidateSetup(session.user.id);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado.",
    };
  }
}
