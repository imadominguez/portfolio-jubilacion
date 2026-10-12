import { after } from "next/server";
import { revalidateTag } from "next/cache";
import type { Currency } from "@/app/generated/prisma/client";
import { marketTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { ratioValue } from "@/lib/byma-listing";
import {
  buildProposal,
  classifyInstrument,
  cleanInstrumentName,
  findListingByName,
  impliedRatio,
  pickUnderlying,
  statusOnRequest,
  type AssetProposal,
  type ListingEntry,
  type SymbolCandidate,
} from "@/lib/asset-resolution";
import { getAssetProfile, getHistorical, searchSymbols } from "@/lib/yahoo-finance-client";

// Cola de pedidos de alta de activos (ADR-0025). El import del snapshot los
// registra y los procesa en segundo plano con after(); el admin los aprueba
// desde Activos. Escribe en la base: el que llama invalida el tag
// `asset-requests` (updateTag en una Server Action, revalidateTag si no).

const DAY_MS = 24 * 60 * 60 * 1000;
// Un pedido en RUNNING más tiempo que esto quedó colgado (after() cortado).
const STUCK_MS = 15 * 60 * 1000;
const MAX_PER_RUN = 10;

export type ObservedPosition = {
  ticker: string;
  instrumentName: string | null;
  price: number;
  currency: Currency;
};

// Registra los tickers del snapshot que no están en el catálogo. Un pedido
// existente se actualiza con la observación más nueva; si había fallado o el
// activo se borró después de darse de alta, vuelve a la cola. Devuelve los
// tickers nuevos para el aviso del import.
export async function enqueueAssetRequests({
  userId,
  snapshotDate,
  ccl,
  positions,
}: {
  userId: string;
  snapshotDate: Date;
  ccl: number | null;
  positions: ObservedPosition[];
}): Promise<string[]> {
  const catalog = new Set((await db.asset.findMany({ select: { ticker: true } })).map((a) => a.ticker));
  const missing = positions.filter((p) => !catalog.has(p.ticker));
  for (const p of missing) {
    const observed = {
      instrumentName: p.instrumentName,
      observedPrice: p.price,
      observedCurrency: p.currency,
      observedCcl: ccl,
      observedAt: snapshotDate,
    };
    const existing = await db.assetRequest.findUnique({ where: { ticker: p.ticker }, select: { status: true } });
    if (!existing) {
      await db.assetRequest.create({ data: { ticker: p.ticker, requestedBy: userId, ...observed } });
    } else {
      const retry = statusOnRequest(existing.status) === "PENDING";
      await db.assetRequest.update({
        where: { ticker: p.ticker },
        data: { ...observed, ...(retry && { status: "PENDING", lastError: null, resolvedAt: null }) },
      });
    }
  }
  return missing.map((p) => p.ticker);
}

// Cierre del subyacente en la fecha del snapshot (o el último hábil anterior).
async function closeOn(symbol: string, date: Date): Promise<number | null> {
  const history = await getHistorical(symbol, new Date(date.getTime() - 7 * DAY_MS), new Date(date.getTime() + DAY_MS));
  const onOrBefore = history.filter((h) => h.date.getTime() <= date.getTime());
  return onOrBefore.at(-1)?.close ?? history[0]?.close ?? null;
}

async function findUnderlying(ticker: string, name: string, markets: string[]): Promise<SymbolCandidate | null> {
  const seen = new Map<string, SymbolCandidate>();
  for (const query of [ticker, name]) {
    for (const c of await searchSymbols(query)) seen.set(c.symbol, c);
    for (const market of markets) {
      const pick = pickUnderlying([...seen.values()], { ticker, name, market });
      if (pick) return pick;
    }
  }
  return null;
}

type RequestRow = {
  ticker: string;
  instrumentName: string | null;
  observedPrice: unknown;
  observedCurrency: Currency | null;
  observedCcl: unknown;
  observedAt: Date | null;
};

export async function resolveAssetRequest(req: RequestRow, listing: ListingEntry[]): Promise<AssetProposal> {
  const base = { ticker: req.ticker, instrumentName: req.instrumentName };
  if (classifyInstrument(req.instrumentName) !== "CEDEAR") {
    return buildProposal({ ...base, listing: null, listingMatchedByName: false, underlying: null, profile: null, impliedRatio: null });
  }

  const cleanName = cleanInstrumentName(req.instrumentName) || req.ticker;
  const byTicker = listing.find((l) => l.ticker === req.ticker) ?? null;
  const entry = byTicker ?? findListingByName(cleanName, listing);
  const name = entry?.name ?? cleanName;
  // Sin fila del listado no se sabe la bolsa: se prueba con las de EE.UU.
  const markets = entry ? [entry.market] : ["NYSE", "NASDAQ", "NYSE Arca"];
  const underlying = await findUnderlying(req.ticker, name, markets);

  const profile = underlying ? await getAssetProfile(underlying.symbol).catch(() => null) : null;
  let implied: number | null = null;
  if (underlying && req.observedAt && req.observedPrice != null && req.observedCurrency) {
    const close = await closeOn(underlying.symbol, req.observedAt).catch(() => null);
    implied = close
      ? impliedRatio({
          underlyingUsd: close,
          cedearPrice: Number(req.observedPrice),
          cedearCurrency: req.observedCurrency,
          ccl: req.observedCcl == null ? null : Number(req.observedCcl),
        })
      : null;
  }

  return buildProposal({
    ...base,
    listing: entry,
    listingMatchedByName: !byTicker && !!entry,
    underlying,
    profile,
    impliedRatio: implied,
  });
}

export type ProcessResult = { ticker: string; status: "NEEDS_REVIEW" | "FAILED"; detail: string };

// Procesa la cola en serie (Yahoo limita las ráfagas). `tickers` acota a los de
// un import; sin él, toma los pendientes y los colgados. En esta etapa todo
// termina en NEEDS_REVIEW con la propuesta: el alta automática es el PR 3.
export async function processAssetRequests(tickers?: string[]): Promise<ProcessResult[]> {
  const stuckBefore = new Date(Date.now() - STUCK_MS);
  const candidates = await db.assetRequest.findMany({
    where: {
      ...(tickers && { ticker: { in: tickers } }),
      OR: [{ status: "PENDING" }, { status: "RUNNING", updatedAt: { lt: stuckBefore } }],
    },
    orderBy: { requestedAt: "asc" },
    take: MAX_PER_RUN,
  });
  if (candidates.length === 0) return [];

  const listing: ListingEntry[] = (await db.cedearListing.findMany()).map((l) => ({
    ticker: l.ticker,
    name: l.name,
    market: l.market,
    ratio: ratioValue({ ratioCedear: Number(l.ratioCedear), ratioUnderlying: Number(l.ratioUnderlying) }),
  }));

  const results: ProcessResult[] = [];
  for (const req of candidates) {
    // Reclamo atómico: si otro proceso lo tomó primero, no se procesa dos veces.
    const claimed = await db.assetRequest.updateMany({
      where: {
        ticker: req.ticker,
        OR: [{ status: "PENDING" }, { status: "RUNNING", updatedAt: { lt: stuckBefore } }],
      },
      data: { status: "RUNNING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    try {
      const proposal = await resolveAssetRequest(req, listing);
      await db.assetRequest.update({
        where: { ticker: req.ticker },
        data: { status: "NEEDS_REVIEW", proposal, lastError: null },
      });
      results.push({
        ticker: req.ticker,
        status: "NEEDS_REVIEW",
        detail: proposal.autoEligible ? "todos los controles en verde" : "con controles pendientes",
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Error inesperado.";
      await db.assetRequest.update({ where: { ticker: req.ticker }, data: { status: "FAILED", lastError: detail } });
      results.push({ ticker: req.ticker, status: "FAILED", detail });
    }
  }
  return results;
}

// Procesa después de responder (import del snapshot, reintento del admin). En
// Vercel after() extiende la función con waitUntil. Afuera de la acción ya no
// hay updateTag: { expire: 0 } hace que el próximo pedido lea el estado nuevo.
// Vive acá y no en app/actions: exportada desde "use server" sería invocable
// desde el cliente.
export function processAssetRequestsInBackground(tickers?: string[]): void {
  after(async () => {
    try {
      await processAssetRequests(tickers);
    } finally {
      revalidateTag(marketTags.assetRequests, { expire: 0 });
    }
  });
}
