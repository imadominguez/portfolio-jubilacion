"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type RetirementSettingsData = {
  currentAge: number;
  retirementAge: number;
  monthlyExpensesUsd: number;
  inflationRate: number;
  withdrawalRate: number;
  monthlyContribution: number;
};

export type RetirementSettingsResult =
  | { success: true }
  | { success: false; error: string };

const SETTINGS_ID = "default";

export async function getRetirementSettings(): Promise<RetirementSettingsData | null> {
  const settings = await db.retirementSettings.findFirst({
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
  };
}

export async function saveRetirementSettings(
  data: RetirementSettingsData
): Promise<RetirementSettingsResult> {
  try {
    if (data.currentAge < 1 || data.currentAge > 100) {
      return { success: false, error: "Edad actual inválida." };
    }
    if (data.retirementAge <= data.currentAge) {
      return { success: false, error: "La edad de retiro debe ser mayor a la edad actual." };
    }
    if (data.monthlyExpensesUsd <= 0) {
      return { success: false, error: "Los gastos mensuales deben ser positivos." };
    }

    const existing = await db.retirementSettings.findFirst();

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
        },
      });
    }

    revalidatePath("/retirement");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}
