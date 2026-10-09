"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateRetirement } from "@/lib/revalidate";
import { userTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { requireAuth, requireUserId } from "@/lib/auth-session";

export type RetirementSettingsData = {
  currentAge: number;
  retirementAge: number;
  monthlyExpensesUsd: number;
  inflationRate: number;
  withdrawalRate: number;
  monthlyContribution: number;
  // Fracción (0.07 = 7 %).
  expectedReturnRate: number;
};

export type RetirementSettingsResult =
  | { success: true }
  | { success: false; error: string };

const SETTINGS_ID = "default";

export async function getRetirementSettings(): Promise<RetirementSettingsData | null> {
  return cachedRetirementSettings(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedRetirementSettings(
  userId: string
): Promise<RetirementSettingsData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.retirement(userId));

  const settings = await db.retirementSettings.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (!settings) return null;

  return {
    currentAge: settings.currentAge,
    retirementAge: settings.retirementAge,
    monthlyExpensesUsd: Number(settings.monthlyExpensesUsd),
    inflationRate: Number(settings.inflationRate),
    withdrawalRate: Number(settings.withdrawalRate),
    monthlyContribution: Number(settings.monthlyContribution),
    expectedReturnRate: Number(settings.expectedReturnRate),
  };
}

export async function saveRetirementSettings(
  data: RetirementSettingsData
): Promise<RetirementSettingsResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    if (data.currentAge < 1 || data.currentAge > 100) {
      return { success: false, error: "Edad actual inválida." };
    }
    if (data.retirementAge <= data.currentAge) {
      return { success: false, error: "La edad de retiro debe ser mayor a la edad actual." };
    }
    if (data.monthlyExpensesUsd <= 0) {
      return { success: false, error: "Los gastos mensuales deben ser positivos." };
    }
    if (!Number.isFinite(data.expectedReturnRate) || data.expectedReturnRate < 0 || data.expectedReturnRate > 0.15) {
      return { success: false, error: "El retorno anual esperado tiene que estar entre 0 % y 15 %." };
    }

    const existing = await db.retirementSettings.findFirst({ where: { userId } });

    if (existing) {
      await db.retirementSettings.update({
        where: { id: existing.id },
        data: {
          currentAge: data.currentAge,
          retirementAge: data.retirementAge,
          monthlyExpensesUsd: data.monthlyExpensesUsd,
          inflationRate: data.inflationRate,
          withdrawalRate: data.withdrawalRate,
          monthlyContribution: data.monthlyContribution,
          expectedReturnRate: data.expectedReturnRate,
        },
      });
    } else {
      await db.retirementSettings.create({
        data: {
          currentAge: data.currentAge,
          retirementAge: data.retirementAge,
          monthlyExpensesUsd: data.monthlyExpensesUsd,
          inflationRate: data.inflationRate,
          withdrawalRate: data.withdrawalRate,
          monthlyContribution: data.monthlyContribution,
          expectedReturnRate: data.expectedReturnRate,
          userId,
        },
      });
    }

    revalidateRetirement(session.user.id);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}
