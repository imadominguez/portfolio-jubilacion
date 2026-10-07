"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateAssets } from "@/lib/revalidate";
import { marketTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-session";

export type AssetFormData = {
  ticker: string;
  instrumentName?: string;
  cedearRatio: number;
  description?: string;
  sector?: string;
  industry?: string;
  country?: string;
  underlyingTicker?: string;
};

export type AssetResult =
  | { success: true }
  | { success: false; error: string };

export type AssetCatalogRow = {
  id: string;
  ticker: string;
  instrumentName: string | null;
  cedearRatio: number;
  description: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  underlyingTicker: string | null;
};

// El catálogo de assets es global (compartido). Sólo un ADMIN puede mutarlo.

// Catálogo completo para la página de Assets. El chequeo de rol queda fuera del
// caché (lee la sesión en cada request); la lectura cacheada no se exporta.
export async function getAssetCatalog(): Promise<AssetCatalogRow[]> {
  await requireAdmin();
  return cachedAssetCatalog();
}

async function cachedAssetCatalog(): Promise<AssetCatalogRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(marketTags.assets);

  const assets = await db.asset.findMany({
    orderBy: { ticker: "asc" },
    select: {
      id: true,
      ticker: true,
      instrumentName: true,
      cedearRatio: true,
      description: true,
      sector: true,
      industry: true,
      country: true,
      underlyingTicker: true,
    },
  });
  return assets.map((a) => ({ ...a, cedearRatio: Number(a.cedearRatio) }));
}

export async function createAsset(data: AssetFormData): Promise<AssetResult> {
  try {
    await requireAdmin();
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
        sector: data.sector?.trim() || null,
        industry: data.industry?.trim() || null,
        country: data.country?.trim() || null,
        underlyingTicker: data.underlyingTicker?.trim().toUpperCase() || null,
      },
    });

    revalidateAssets();
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
    await requireAdmin();
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
        ...(data.sector !== undefined && {
          sector: data.sector?.trim() || null,
        }),
        ...(data.industry !== undefined && {
          industry: data.industry?.trim() || null,
        }),
        ...(data.country !== undefined && {
          country: data.country?.trim() || null,
        }),
        ...(data.underlyingTicker !== undefined && {
          underlyingTicker: data.underlyingTicker?.trim().toUpperCase() || null,
        }),
      },
    });

    revalidateAssets();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: msg };
  }
}

export async function deleteAsset(id: string): Promise<AssetResult> {
  try {
    await requireAdmin();
    await db.asset.delete({ where: { id } });
    revalidateAssets();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo eliminar el activo.",
    };
  }
}
