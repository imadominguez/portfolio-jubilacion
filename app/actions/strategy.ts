"use server";

import { db } from "@/lib/db";
import type { InvestmentStrategy } from "@/app/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function getActiveStrategy(): Promise<InvestmentStrategy | null> {
  return db.investmentStrategy.findFirst({ where: { isActive: true } });
}

export async function getStrategyHistory(): Promise<InvestmentStrategy[]> {
  return db.investmentStrategy.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function saveNewVersion(
  content: string,
  title: string
): Promise<{ ok: true; strategy: InvestmentStrategy } | { ok: false; error: string }> {
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

    revalidatePath("/strategy");
    return { ok: true, strategy };
  } catch (e) {
    console.error("saveNewVersion error:", e);
    return { ok: false, error: "Error al guardar la nueva versión." };
  }
}

export async function restoreVersion(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
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

    revalidatePath("/strategy");
    return { ok: true };
  } catch (e) {
    console.error("restoreVersion error:", e);
    return { ok: false, error: "Error al restaurar la versión." };
  }
}
