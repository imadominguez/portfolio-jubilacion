"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateMilestones } from "@/lib/revalidate";
import { userTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { requireAuth, requireUserId } from "@/lib/auth-session";

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
  return cachedMilestones(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedMilestones(userId: string): Promise<MilestoneRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.milestones(userId));

  const query = {
    where: { userId },
    orderBy: { targetValueUsd: "asc" },
  } as const;
  // Solo lectura: los hitos por defecto se crean al importar el primer snapshot
  // (checkAndUpdateMilestones). Crearlos acá escribía dentro de 'use cache' y
  // los recreaba si el usuario borraba todos.
  const milestones = await db.milestoneAlert.findMany(query);

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

    revalidateMilestones(session.user.id);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteMilestone(id: string): Promise<MilestoneResult> {
  try {
    const userId = await requireUserId();
    const result = await db.milestoneAlert.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return { success: false, error: "No se encontró el hito." };
    }
    revalidateMilestones(userId);
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar." };
  }
}

// Se llama después de importar un snapshot. Con `isFirstSnapshot`, crea los
// hitos por defecto si el usuario todavía no tiene ninguno (solo esa vez: si
// después los borra todos, no vuelven).
export async function checkAndUpdateMilestones(
  currentValueUsd: number,
  { isFirstSnapshot = false }: { isFirstSnapshot?: boolean } = {}
): Promise<{ newlyReached: MilestoneRow[] }> {
  const session = await requireAuth();

  let seeded = false;
  if (isFirstSnapshot) {
    const existing = await db.milestoneAlert.count({ where: { userId: session.user.id } });
    if (existing === 0) {
      await db.milestoneAlert.createMany({
        data: DEFAULT_MILESTONES.map((m) => ({ ...m, userId: session.user.id })),
      });
      seeded = true;
    }
  }

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

  if (seeded || newlyReached.length > 0) revalidateMilestones(session.user.id);

  return { newlyReached };
}
