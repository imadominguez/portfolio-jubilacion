"use server";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUserId } from "@/lib/auth-session";
import { marketTags, userTags } from "@/lib/cache-tags";
import { revalidateAssetRequests, revalidateAssets, revalidateRatioProposals } from "@/lib/revalidate";
import { updateAsset } from "@/app/actions/assets";
import { processAssetRequestsInBackground } from "@/lib/asset-requests-runner";
import type { AssetProposal } from "@/lib/asset-resolution";
import type { AssetRequestStatus } from "@/app/generated/prisma/client";

// Pedidos de alta de activos (ADR-0025). El usuario ve el estado de los
// tickers de su snapshot; el admin ve la cola completa y aprueba.

export type MyAssetStatus = {
  // Buscando datos (PENDING o RUNNING).
  searching: string[];
  // Esperan que un admin los revise (NEEDS_REVIEW o FAILED).
  waiting: string[];
};

// Tickers del último snapshot del usuario que todavía no tienen activo.
export async function getMyAssetStatus(): Promise<MyAssetStatus> {
  return cachedMyAssetStatus(await requireUserId());
}

async function cachedMyAssetStatus(userId: string): Promise<MyAssetStatus> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.snapshots(userId), marketTags.assetRequests, marketTags.assets);

  const latest = await db.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotDate: "desc" },
    select: { positions: { select: { ticker: true } } },
  });
  const tickers = [...new Set(latest?.positions.map((p) => p.ticker) ?? [])];
  if (tickers.length === 0) return { searching: [], waiting: [] };

  const [requests, assets] = await Promise.all([
    db.assetRequest.findMany({
      where: { ticker: { in: tickers }, status: { not: "DONE" } },
      select: { ticker: true, status: true },
      orderBy: { ticker: "asc" },
    }),
    db.asset.findMany({ where: { ticker: { in: tickers } }, select: { ticker: true } }),
  ]);
  const inCatalog = new Set(assets.map((a) => a.ticker));
  const open = requests.filter((r) => !inCatalog.has(r.ticker));
  return {
    searching: open.filter((r) => r.status === "PENDING" || r.status === "RUNNING").map((r) => r.ticker),
    waiting: open.filter((r) => r.status === "NEEDS_REVIEW" || r.status === "FAILED").map((r) => r.ticker),
  };
}

export type AssetRequestRow = {
  ticker: string;
  instrumentName: string | null;
  status: AssetRequestStatus;
  attempts: number;
  lastError: string | null;
  proposal: AssetProposal | null;
  requestedAt: Date;
};

export async function getAssetRequests(): Promise<AssetRequestRow[]> {
  await requireAdmin();
  return cachedAssetRequests();
}

async function cachedAssetRequests(): Promise<AssetRequestRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(marketTags.assetRequests);

  const rows = await db.assetRequest.findMany({
    where: { status: { not: "DONE" } },
    orderBy: { requestedAt: "asc" },
  });
  return rows.map((r) => ({
    ticker: r.ticker,
    instrumentName: r.instrumentName,
    status: r.status,
    attempts: r.attempts,
    lastError: r.lastError,
    proposal: (r.proposal as AssetProposal | null) ?? null,
    requestedAt: r.requestedAt,
  }));
}

export type ApproveAssetData = {
  cedearRatio: number;
  underlyingTicker?: string;
  sector?: string;
  industry?: string;
  country?: string;
};

export type AssetRequestResult = { success: true } | { success: false; error: string };

// Da de alta el activo con lo propuesto (o lo corregido por el admin) y cierra
// el pedido. Queda como AUTO y revisado.
export async function approveAssetRequest(ticker: string, data: ApproveAssetData): Promise<AssetRequestResult> {
  try {
    await requireAdmin();
    if (!(data.cedearRatio > 0)) return { success: false, error: "El ratio debe ser mayor a 0." };
    const req = await db.assetRequest.findUnique({ where: { ticker } });
    if (!req) return { success: false, error: "El pedido no existe." };
    const proposal = req.proposal as AssetProposal | null;
    const clean = (v?: string) => v?.trim() || null;

    const exists = await db.asset.findUnique({ where: { ticker }, select: { id: true } });
    await db.$transaction([
      ...(exists
        ? []
        : [
            db.asset.create({
              data: {
                ticker,
                instrumentName: req.instrumentName,
                cedearRatio: data.cedearRatio,
                underlyingTicker: clean(data.underlyingTicker)?.toUpperCase() ?? null,
                sector: clean(data.sector),
                industry: clean(data.industry),
                country: clean(data.country),
                assetKind: proposal?.kind ?? "CEDEAR",
                source: "AUTO",
                reviewedAt: new Date(),
              },
            }),
          ]),
      db.assetRequest.update({ where: { ticker }, data: { status: "DONE", resolvedAt: new Date() } }),
    ]);

    revalidateAssets();
    revalidateAssetRequests();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo dar de alta el activo." };
  }
}

// Vuelve a buscar los datos (por ejemplo, después de actualizar el listado).
export async function retryAssetRequest(ticker: string): Promise<AssetRequestResult> {
  try {
    await requireAdmin();
    await db.assetRequest.update({ where: { ticker }, data: { status: "PENDING", lastError: null } });
    revalidateAssetRequests();
    processAssetRequestsInBackground([ticker]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo reintentar." };
  }
}

// Saca el pedido de la cola. Si el ticker sigue en algún snapshot, el próximo
// import lo vuelve a pedir.
export async function dismissAssetRequest(ticker: string): Promise<AssetRequestResult> {
  try {
    await requireAdmin();
    await db.assetRequest.delete({ where: { ticker } });
    revalidateAssetRequests();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo descartar el pedido." };
  }
}

// ---------------------------------------------------------------------------
// Cambios de ratio detectados en el listado de BYMA (ADR-0027)
// ---------------------------------------------------------------------------

export type RatioProposalRow = {
  ticker: string;
  oldRatio: number;
  newRatio: number;
  // Versión del listado que lo mostró (fecha sugerida para el split).
  listingVersion: Date;
};

export async function getRatioProposals(): Promise<RatioProposalRow[]> {
  await requireAdmin();
  return cachedRatioProposals();
}

async function cachedRatioProposals(): Promise<RatioProposalRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(marketTags.ratioProposals);

  const rows = await db.ratioChangeProposal.findMany({ where: { status: "PENDING" }, orderBy: { ticker: "asc" } });
  return rows.map((r) => ({
    ticker: r.ticker,
    oldRatio: Number(r.oldRatio),
    newRatio: Number(r.newRatio),
    listingVersion: r.listingVersion,
  }));
}

// Aplica el ratio nuevo. Con fecha es un split: se registra la
// CedearRatioChange y las operaciones anteriores se ajustan (ADR-0023). Sin
// fecha es una corrección del catálogo.
export async function applyRatioProposal(
  ticker: string,
  newRatio: number,
  effectiveDate: string | null
): Promise<AssetRequestResult> {
  try {
    await requireAdmin();
    const asset = await db.asset.findUnique({ where: { ticker }, select: { id: true } });
    if (!asset) return { success: false, error: `${ticker} ya no está en el catálogo.` };
    const result = await updateAsset(asset.id, { cedearRatio: newRatio, ratioChangeDate: effectiveDate ?? undefined });
    if (!result.success) return result;
    await db.ratioChangeProposal.update({
      where: { ticker_newRatio: { ticker, newRatio } },
      data: { status: "APPLIED", resolvedAt: new Date() },
    });
    revalidateRatioProposals();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo aplicar el cambio de ratio." };
  }
}

// El catálogo está bien (por ejemplo, un error del listado). No se vuelve a
// proponer el mismo ratio.
export async function dismissRatioProposal(ticker: string, newRatio: number): Promise<AssetRequestResult> {
  try {
    await requireAdmin();
    await db.ratioChangeProposal.update({
      where: { ticker_newRatio: { ticker, newRatio } },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    revalidateRatioProposals();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo descartar el cambio." };
  }
}
