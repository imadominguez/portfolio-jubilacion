"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-session";

export type MilestoneRow = {
  id: string;
  label: string;
  targetValueUsd: number;
  reached: boolean;
  reachedAt: Date | null;
};

export type MilestoneResult =
  | { success: true }
  | { success: false; error: string };

const DEFAULT_MILESTONES = [
  { label: "USD 10.000", targetValueUsd: 10000 },
  { label: "USD 25.000", targetValueUsd: 25000 },
  { label: "USD 50.000", targetValueUsd: 50000 },
  { label: "USD 100.000", targetValueUsd: 100000 },
  { label: "USD 250.000", targetValueUsd: 250000 },
];

export async function getMilestones(): Promise<MilestoneRow[]> {
  const session = await requireAuth();
  const userId = session.user.id;
  const milestones = await db.milestoneAlert.findMany({
    where: { userId },
    orderBy: { targetValueUsd: "asc" },
  });

  if (milestones.length === 0) {
    await db.milestoneAlert.createMany({
      data: DEFAULT_MILESTONES.map((m) => ({ ...m, userId })),
    });
    return DEFAULT_MILESTONES.map((m) => ({
      id: "",
      label: m.label,
      targetValueUsd: m.targetValueUsd,
      reached: false,
      reachedAt: null,
    }));
  }

  return milestones.map((m) => ({
    id: m.id,
    label: m.label,
    targetValueUsd: Number(m.targetValueUsd),
    reached: m.reached,
    reachedAt: m.reachedAt,
  }));
}

export async function createMilestone(
  label: string,
  targetValueUsd: number
): Promise<MilestoneResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    if (!label.trim()) return { success: false, error: "El nombre es obligatorio." };
    if (targetValueUsd <= 0) return { success: false, error: "El valor debe ser positivo." };

    await db.milestoneAlert.create({
      data: { label: label.trim(), targetValueUsd, userId },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteMilestone(id: string): Promise<MilestoneResult> {
  try {
    await db.milestoneAlert.delete({ where: { id } });
    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar." };
  }
}

export async function checkAndUpdateMilestones(
  currentValueUsd: number
): Promise<{ newlyReached: MilestoneRow[] }> {
  const session = await requireAuth();
  const unReached = await db.milestoneAlert.findMany({
    where: { reached: false, userId: session.user.id },
  });

  const newlyReached: MilestoneRow[] = [];

  for (const milestone of unReached) {
    if (currentValueUsd >= Number(milestone.targetValueUsd)) {
      const updated = await db.milestoneAlert.update({
        where: { id: milestone.id },
        data: { reached: true, reachedAt: new Date() },
      });
      newlyReached.push({
        id: updated.id,
        label: updated.label,
        targetValueUsd: Number(updated.targetValueUsd),
        reached: true,
        reachedAt: updated.reachedAt,
      });
    }
  }

  return { newlyReached };
}
