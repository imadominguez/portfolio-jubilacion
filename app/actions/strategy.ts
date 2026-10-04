"use server";

import { db } from "@/lib/db";
import type { InvestmentStrategy } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/auth-session";
import { revalidateStrategy } from "@/lib/revalidate";

// La estrategia es global (system prompt del análisis IA): leerla y cambiarla
// es exclusivo de ADMIN. /api/analyze-portfolio lee la activa directo de la DB.

type StrategyError = { ok: false; error: string };

async function adminGuard(): Promise<StrategyError | null> {
  try {
    await requireAdmin();
    return null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No autorizado." };
  }
}

export async function getActiveStrategy(): Promise<InvestmentStrategy | null> {
  await requireAdmin();
  return db.investmentStrategy.findFirst({ where: { isActive: true } });
}

export async function getStrategyHistory(): Promise<InvestmentStrategy[]> {
  await requireAdmin();
  return db.investmentStrategy.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function saveNewVersion(
  content: string,
  title: string
): Promise<{ ok: true; strategy: InvestmentStrategy } | StrategyError> {
  const denied = await adminGuard();
  if (denied) return denied;

  if (!content.trim()) return { ok: false, error: "El contenido no puede estar vacío." };
  if (!title.trim()) return { ok: false, error: "El título no puede estar vacío." };

  try {
    const lastVersion = await db.investmentStrategy.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const strategy = await db.$transaction(async (tx) => {
      await tx.investmentStrategy.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.investmentStrategy.create({
        data: { content: content.trim(), title: title.trim(), isActive: true, version: nextVersion },
      });
    });

    revalidateStrategy();
    return { ok: true, strategy };
  } catch (e) {
    console.error("saveNewVersion error:", e);
    return { ok: false, error: "Error al guardar la nueva versión." };
  }
}

export async function restoreVersion(
  id: string
): Promise<{ ok: true } | StrategyError> {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    await db.$transaction(async (tx) => {
      await tx.investmentStrategy.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      await tx.investmentStrategy.update({
        where: { id },
        data: { isActive: true },
      });
    });

    revalidateStrategy();
    return { ok: true };
  } catch (e) {
    console.error("restoreVersion error:", e);
    return { ok: false, error: "Error al restaurar la versión." };
  }
}
