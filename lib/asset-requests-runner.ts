import { after } from "next/server";
import { revalidateTag } from "next/cache";
import type { Currency } from "@/app/generated/prisma/client";
import { marketTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { diffCatalogRatios, ratioValue } from "@/lib/byma-listing";
import {
  buildProposal,
  classifyInstrument,
  cleanInstrumentName,
  findListingByName,
  impliedRatio,
  pickUnderlying,
  MAX_ATTEMPTS,
  requestOutcome,
  shouldNotifyAdmin,
  statusOnRequest,
  type AssetProposal,
  type ListingEntry,
  type SymbolCandidate,
} from "@/lib/asset-resolution";
import { getAssetProfile, getHistorical, searchSymbols } from "@/lib/yahoo-finance-client";
import { saveMarketPrices, saveStockHistory } from "@/lib/market-refresh";
import { isMailerConfigured, sendMail } from "@/lib/mailer";
import { buildAssetReviewEmail, buildRatioChangeEmail, type ReviewItem } from "@/lib/asset-review-email";

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

export type ProcessResult = { ticker: string; status: "DONE" | "NEEDS_REVIEW" | "FAILED"; detail: string };

export type ProcessSummary = {
  results: ProcessResult[];
  // Tags que el que llama tiene que invalidar (updateTag no está disponible acá).
  tags: string[];
};

// Da de alta el activo de una propuesta que pasó todos los controles y cierra
// el pedido, en una transacción. Queda como AUTO sin revisar (ADR-0026).
async function createFromProposal(req: RequestRow, proposal: AssetProposal): Promise<void> {
  const exists = await db.asset.findUnique({ where: { ticker: req.ticker }, select: { id: true } });
  await db.$transaction([
    ...(exists
      ? []
      : [
          db.asset.create({
            data: {
              ticker: req.ticker,
              instrumentName: req.instrumentName,
              cedearRatio: proposal.cedearRatio ?? 1,
              underlyingTicker: proposal.underlyingTicker,
              sector: proposal.sector,
              industry: proposal.industry,
              country: proposal.country,
              assetKind: proposal.kind,
              source: "AUTO",
            },
          }),
        ]),
    db.assetRequest.update({
      where: { ticker: req.ticker },
      data: { status: "DONE", proposal, lastError: null, resolvedAt: new Date() },
    }),
  ]);
}

async function notifyAdmins(items: ReviewItem[]): Promise<void> {
  if (items.length === 0) return;
  await mailAdmins(buildAssetReviewEmail(items, process.env.NEXT_PUBLIC_APP_URL ?? ""));
}

async function mailAdmins(email: { subject: string; text: string; html: string } | null): Promise<void> {
  if (!email || !isMailerConfigured()) return;
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  for (const admin of admins) {
    // Un mail que falla no frena al resto ni deja el pedido a medias.
    await sendMail({ to: admin.email, ...email }).catch(() => undefined);
  }
}

// Procesa la cola en serie (Yahoo limita las ráfagas). `tickers` acota a los de
// un import; sin él toma los pendientes y los colgados, y con `retryFailed`
// (cron) también los que fallaron y tienen intentos disponibles.
export async function processAssetRequests(
  options: { tickers?: string[]; retryFailed?: boolean } = {}
): Promise<ProcessSummary> {
  const stuckBefore = new Date(Date.now() - STUCK_MS);
  const claimable = [
    { status: "PENDING" as const },
    { status: "RUNNING" as const, updatedAt: { lt: stuckBefore } },
    ...(options.retryFailed ? [{ status: "FAILED" as const, attempts: { lt: MAX_ATTEMPTS } }] : []),
  ];
  const candidates = await db.assetRequest.findMany({
    where: { ...(options.tickers && { ticker: { in: options.tickers } }), OR: claimable },
    orderBy: { requestedAt: "asc" },
    take: MAX_PER_RUN,
  });
  if (candidates.length === 0) return { results: [], tags: [] };

  const listing: ListingEntry[] = (await db.cedearListing.findMany()).map((l) => ({
    ticker: l.ticker,
    name: l.name,
    market: l.market,
    ratio: ratioValue({ ratioCedear: Number(l.ratioCedear), ratioUnderlying: Number(l.ratioUnderlying) }),
  }));

  const results: ProcessResult[] = [];
  const toReview: ReviewItem[] = [];
  const newUnderlyings: string[] = [];
  for (const req of candidates) {
    // Reclamo atómico: si otro proceso lo tomó primero, no se procesa dos veces.
    const claimed = await db.assetRequest.updateMany({
      where: { ticker: req.ticker, OR: claimable },
      data: { status: "RUNNING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    const attempts = req.attempts + 1;

    try {
      const proposal = await resolveAssetRequest(req, listing);
      if (requestOutcome(proposal) === "DONE") {
        await createFromProposal(req, proposal);
        if (proposal.underlyingTicker) newUnderlyings.push(proposal.underlyingTicker);
        results.push({ ticker: req.ticker, status: "DONE", detail: "dado de alta" });
        continue;
      }
      await db.assetRequest.update({
        where: { ticker: req.ticker },
        data: { status: "NEEDS_REVIEW", proposal, lastError: null },
      });
      results.push({ ticker: req.ticker, status: "NEEDS_REVIEW", detail: "con controles pendientes" });
      if (shouldNotifyAdmin("NEEDS_REVIEW", attempts)) {
        toReview.push({
          ticker: req.ticker,
          instrumentName: req.instrumentName,
          status: "NEEDS_REVIEW",
          reasons: proposal.checks.filter((c) => !c.ok).map((c) => c.detail),
        });
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Error inesperado.";
      await db.assetRequest.update({ where: { ticker: req.ticker }, data: { status: "FAILED", lastError: detail } });
      results.push({ ticker: req.ticker, status: "FAILED", detail });
      if (shouldNotifyAdmin("FAILED", attempts)) {
        toReview.push({ ticker: req.ticker, instrumentName: req.instrumentName, status: "FAILED", reasons: [detail] });
      }
    }
  }

  const tags = new Set<string>([marketTags.assetRequests]);
  if (results.some((r) => r.status === "DONE")) tags.add(marketTags.assets);
  // Precio e históricos solo de los subyacentes nuevos, para que las pantallas
  // tengan datos sin esperar al cron. Si Yahoo falla, los trae el cron.
  if (newUnderlyings.length > 0) {
    await saveMarketPrices(newUnderlyings).then(() => tags.add(marketTags.marketPrices)).catch(() => undefined);
    await saveStockHistory({ only: newUnderlyings }).then(() => tags.add(marketTags.historicalPrices)).catch(() => undefined);
  }
  await notifyAdmins(toReview);
  return { results, tags: [...tags] };
}

// Procesa después de responder (import del snapshot, reintento del admin). En
// Vercel after() extiende la función con waitUntil. Afuera de la acción ya no
// hay updateTag: { expire: 0 } hace que el próximo pedido lea el estado nuevo.
// Vive acá y no en app/actions: exportada desde "use server" sería invocable
// desde el cliente.
export function processAssetRequestsInBackground(tickers?: string[]): void {
  after(async () => {
    let tags: string[] = [marketTags.assetRequests];
    try {
      tags = (await processAssetRequests({ tickers })).tags;
    } finally {
      for (const tag of tags) revalidateTag(tag, { expire: 0 });
    }
  });
}

// ---------------------------------------------------------------------------
// Cambios de ratio desde el listado de BYMA (ADR-0027)
// ---------------------------------------------------------------------------

// Compara el catálogo con el listado vigente y propone los cambios nuevos. Las
// propuestas pendientes que el catálogo ya refleja (un admin cargó el ratio a
// mano) se cierran solas. Avisa por mail solo de las nuevas. Devuelve si hubo
// cambios, para que el que llama invalide el tag `ratio-proposals`.
export async function detectRatioChanges(): Promise<{ created: number; closed: number }> {
  const latest = await db.cedearListingVersion.findFirst({ orderBy: { version: "desc" } });
  if (!latest) return { created: 0, closed: 0 };

  const [assets, listing, pending] = await Promise.all([
    db.asset.findMany({ select: { ticker: true, cedearRatio: true, assetKind: true } }),
    db.cedearListing.findMany({ select: { ticker: true, ratioCedear: true, ratioUnderlying: true } }),
    db.ratioChangeProposal.findMany({ where: { status: "PENDING" } }),
  ]);
  const catalog = assets.map((a) => ({ ticker: a.ticker, ratio: Number(a.cedearRatio), kind: a.assetKind }));
  const diffs = diffCatalogRatios(
    catalog,
    listing.map((l) => ({ ticker: l.ticker, ratioCedear: Number(l.ratioCedear), ratioUnderlying: Number(l.ratioUnderlying) }))
  );

  const current = new Map(catalog.map((a) => [a.ticker, a.ratio]));
  let closed = 0;
  for (const p of pending) {
    const ratio = current.get(p.ticker);
    if (ratio !== undefined && Math.abs(ratio - Number(p.newRatio)) <= 1e-3) {
      await db.ratioChangeProposal.update({
        where: { ticker_newRatio: { ticker: p.ticker, newRatio: p.newRatio } },
        data: { status: "APPLIED", resolvedAt: new Date() },
      });
      closed++;
    }
  }

  const created: { ticker: string; oldRatio: number; newRatio: number }[] = [];
  for (const d of diffs) {
    // Redondeado como lo guarda la columna: la clave tiene que coincidir.
    const newRatio = Math.round(d.newRatio * 10_000) / 10_000;
    const exists = await db.ratioChangeProposal.findUnique({
      where: { ticker_newRatio: { ticker: d.ticker, newRatio } },
      select: { status: true },
    });
    if (exists) continue;
    await db.ratioChangeProposal.create({
      data: { ticker: d.ticker, newRatio, oldRatio: d.oldRatio, listingVersion: latest.version },
    });
    created.push(d);
  }

  const label = latest.version.toISOString().slice(0, 10).split("-").reverse().join("/");
  await mailAdmins(buildRatioChangeEmail(created, label, process.env.NEXT_PUBLIC_APP_URL ?? ""));
  return { created: created.length, closed };
}
