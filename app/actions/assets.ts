"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type AssetFormData = {
  ticker: string;
  instrumentName?: string;
  cedearRatio: number;
  description?: string;
};

export type AssetResult =
  | { success: true }
  | { success: false; error: string };

export async function createAsset(data: AssetFormData): Promise<AssetResult> {
  try {
    if (!data.ticker.trim()) {
      return { success: false, error: "El ticker es obligatorio." };
    }
    if (data.cedearRatio <= 0) {
      return { success: false, error: "El ratio debe ser mayor a 0." };
    }

    await db.asset.create({
      data: {
        ticker: data.ticker.trim().toUpperCase(),
        instrumentName: data.instrumentName?.trim() || null,
        cedearRatio: data.cedearRatio,
        description: data.description?.trim() || null,
      },
    });

    revalidatePath("/assets");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado.";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: `El ticker ${data.ticker.toUpperCase()} ya existe.` };
    }
    return { success: false, error: msg };
  }
}

export async function updateAsset(
  id: string,
  data: Partial<AssetFormData>
): Promise<AssetResult> {
  try {
    await db.asset.update({
      where: { id },
      data: {
        ...(data.instrumentName !== undefined && {
          instrumentName: data.instrumentName?.trim() || null,
        }),
        ...(data.cedearRatio !== undefined && {
          cedearRatio: data.cedearRatio,
        }),
        ...(data.description !== undefined && {
          description: data.description?.trim() || null,
        }),
      },
    });

    revalidatePath("/assets");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: msg };
  }
}

export async function deleteAsset(id: string): Promise<AssetResult> {
  try {
    await db.asset.delete({ where: { id } });
    revalidatePath("/assets");
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar el activo." };
  }
}
