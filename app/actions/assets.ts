"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateAssets, revalidateCedearListing } from "@/lib/revalidate";
import { marketTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-session";
import { saveCedearListing } from "@/lib/market-refresh";
import { ratioValue } from "@/lib/byma-listing";

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
  // Alta automática que ningún admin revisó todavía (ADR-0026).
  needsReview: boolean;
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
      source: true,
      reviewedAt: true,
    },
  });
  return assets.map(({ source, reviewedAt, ...a }) => ({
    ...a,
    cedearRatio: Number(a.cedearRatio),
    needsReview: source === "AUTO" && reviewedAt === null,
  }));
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
  data: Partial<AssetFormData> & {
    // YYYY-MM-DD. Con fecha, un ratio distinto es un split del CEDEAR y las
    // operaciones anteriores se ajustan (ADR-0023); sin fecha, una corrección.
    ratioChangeDate?: string;
  }
): Promise<AssetResult> {
  try {
    await requireAdmin();
    if (data.cedearRatio !== undefined && !(data.cedearRatio > 0)) {
      return { success: false, error: "El ratio debe ser mayor a 0." };
    }

    const current = await db.asset.findUnique({ where: { id }, select: { ticker: true, cedearRatio: true, source: true } });
    if (!current) return { success: false, error: "El activo no existe." };

    const ratioChangeDate = data.ratioChangeDate?.trim();
    const ratioChanged = data.cedearRatio !== undefined && data.cedearRatio !== Number(current.cedearRatio);
    if (ratioChangeDate && !ratioChanged) {
      return { success: false, error: "Indicaste una fecha de cambio de ratio pero el ratio no cambió." };
    }
    if (ratioChangeDate && !/^\d{4}-\d{2}-\d{2}$/.test(ratioChangeDate)) {
      return { success: false, error: "La fecha del cambio de ratio no es válida." };
    }

    const recordChange = ratioChangeDate && ratioChanged
      ? [
          db.cedearRatioChange.create({
            data: {
              ticker: current.ticker,
              effectiveDate: new Date(`${ratioChangeDate}T00:00:00Z`),
              oldRatio: current.cedearRatio,
              newRatio: data.cedearRatio!,
            },
          }),
        ]
      : [];

    await db.$transaction([
      ...recordChange,
      db.asset.update({
        where: { id },
        data: {
          // Editar un alta automática cuenta como revisarla.
          ...(current.source === "AUTO" && { reviewedAt: new Date() }),
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
      }),
    ]);

    revalidateAssets();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado.";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "Ya hay un cambio de ratio registrado para ese activo en esa fecha." };
    }
    return { success: false, error: msg };
  }
}

// Confirma un alta automática sin cambiarle nada.
export async function markAssetReviewed(id: string): Promise<AssetResult> {
  try {
    await requireAdmin();
    await db.asset.update({ where: { id }, data: { reviewedAt: new Date() } });
    revalidateAssets();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo marcar como revisado." };
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

// ---------------------------------------------------------------------------
// Listado oficial de BYMA (ADR-0024)
// ---------------------------------------------------------------------------

export type CedearListingEntry = { ticker: string; name: string; market: string; ratio: number; ratioText: string };

export type CedearListingInfo = {
  // null si todavía no se bajó ninguna versión.
  version: Date | null;
  fetchedAt: Date | null;
  rowCount: number;
  // Las entradas de los tickers pedidos que figuran en el listado.
  entries: Record<string, CedearListingEntry>;
};

export async function getCedearListingInfo(tickers: string[]): Promise<CedearListingInfo> {
  await requireAdmin();
  return cachedCedearListingInfo([...new Set(tickers)].sort());
}

async function cachedCedearListingInfo(tickers: string[]): Promise<CedearListingInfo> {
  "use cache";
  cacheLife("hours");
  cacheTag(marketTags.cedearListing);

  const [latest, rows] = await Promise.all([
    db.cedearListingVersion.findFirst({ orderBy: { version: "desc" } }),
    tickers.length ? db.cedearListing.findMany({ where: { ticker: { in: tickers } } }) : Promise.resolve([]),
  ]);
  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 4 });
  return {
    version: latest?.version ?? null,
    fetchedAt: latest?.fetchedAt ?? null,
    rowCount: latest?.rowCount ?? 0,
    entries: Object.fromEntries(
      rows.map((r) => {
        const parts = { ratioCedear: Number(r.ratioCedear), ratioUnderlying: Number(r.ratioUnderlying) };
        return [
          r.ticker,
          {
            ticker: r.ticker,
            name: r.name,
            market: r.market,
            ratio: ratioValue(parts),
            ratioText: `${fmt(parts.ratioCedear)}:${fmt(parts.ratioUnderlying)}`,
          },
        ];
      })
    ),
  };
}

export type RefreshListingResult =
  | { success: true; message: string }
  | { success: false; error: string };

// Fuerza la descarga del listado aunque la versión guardada sea reciente.
export async function refreshCedearListing(): Promise<RefreshListingResult> {
  try {
    await requireAdmin();
    const r = await saveCedearListing({ force: true });
    revalidateCedearListing();
    const v = r.version.toISOString().slice(0, 10).split("-").reverse().join("/");
    return {
      success: true,
      message: r.status === "updated" ? `Listado del ${v} guardado: ${r.rows} CEDEARs.` : `El listado del ${v} sigue vigente.`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo actualizar el listado de BYMA." };
  }
}
