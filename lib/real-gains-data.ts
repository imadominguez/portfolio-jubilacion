import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-session";
import { marketTags, userTags } from "@/lib/cache-tags";
import { loadRatioChanges } from "@/lib/portfolio-data";
import { adjustForRatioChanges } from "@/lib/ratio-changes";
import { costBasisByTicker } from "@/lib/real-gains";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PositionGains = {
  ticker: string;
  underlyingTicker: string | null;
  quantity: number;
  cedearRatio: number;

  // Costo (lo que se pagó)
  costArs: number;
  costUsdCcl: number | null;   // Método A: costo en USD usando CCL en fecha de compra
  costUsdStock: number | null; // Método B: costo en USD usando precio del subyacente en fecha de compra

  // Valor actual
  valueArs: number;
  valueUsdCcl: number | null;   // Método A: valor en USD usando CCL actual
  valueUsdStock: number | null; // Método B: valor en USD usando precio actual del subyacente

  // Ganancias
  gainArs: number;
  gainUsdReal: number | null;        // A: ganancia real en USD
  gainUsdAppreciation: number | null; // B: ganancia por apreciación del subyacente
  gainUsdCclImpact: number | null;    // A - B: cuánto aportó (o costó) el CCL

  // Porcentajes
  gainPctArs: number | null;
  gainPctUsdReal: number | null;
  gainPctUsdAppreciation: number | null;

  // Calidad del dato
  cclApproximate: boolean; // si se usó CCL de fecha cercana (no exacta)
  stockPriceAvailable: boolean;
  missingReason: string | null; // null = datos completos para los 3 cálculos
};

export type RealGainsSummary = {
  positions: PositionGains[];

  // Totales del portfolio
  totalCostArs: number;
  totalCostUsdCcl: number | null;
  totalCostUsdStock: number | null;
  totalValueArs: number;
  totalValueUsdCcl: number | null;
  totalValueUsdStock: number | null;

  totalGainArs: number;
  totalGainUsdReal: number | null;
  totalGainUsdAppreciation: number | null;
  totalGainUsdCclImpact: number | null;

  totalGainPctArs: number | null;
  totalGainPctUsdReal: number | null;
  totalGainPctUsdAppreciation: number | null;

  // Cobertura de datos
  positionsWithFullData: number;
  positionsTotal: number;
  cclCoverage: number; // % de transacciones con CCL disponible
};

export type DataReadiness = {
  hasSnapshot: boolean;
  hasTransactions: boolean;
  hasCclHistory: number;       // cantidad de registros CCL en ExchangeRate
  hasStockHistory: number;     // cantidad de registros en HistoricalPriceCache
  transactionCount: number;
  firstBuyDate: Date | null;
  needsBackfill: boolean;              // hay compras anteriores a la cobertura de históricos/CCL
  tickersMissingHistory: string[];     // subyacentes sin precio/CCL cerca de su primera compra
  oldestCclDate: Date | null;
  oldestHistoricalPriceDate: Date | null;
};

// Márgenes equivalentes a los usados en calculateRealGains (findNearest).
const PRICE_TOLERANCE_DAYS = 5;
const CCL_TOLERANCE_DAYS = 7;

function daysAfter(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// Helper: nearest date lookup
//
// Dado un array ordenado de { date: Date, value: number } y una fecha objetivo,
// devuelve el valor más cercano dentro del margen de días especificado.
// ---------------------------------------------------------------------------

function findNearest<T extends { date: Date }>(
  items: T[],
  target: Date,
  maxDaysDiff: number
): T | null {
  const targetTs = target.getTime();
  let best: T | null = null;
  let bestDiff = Infinity;

  for (const item of items) {
    const diff = Math.abs(item.date.getTime() - targetTs);
    const daysDiff = diff / (1000 * 60 * 60 * 24);
    if (daysDiff <= maxDaysDiff && diff < bestDiff) {
      bestDiff = diff;
      best = item;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// getDataReadiness
//
// Verifica si hay datos suficientes para calcular las ganancias reales.
// Se usa en la página para mostrar el wizard cuando faltan datos.
// ---------------------------------------------------------------------------

export async function getDataReadiness(): Promise<DataReadiness> {
  return cachedDataReadiness(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017). Un tag
// por dominio leído; importMovements la vuelve a leer después de updateTag, así
// que el resultado post-import sale fresco.
async function cachedDataReadiness(userId: string): Promise<DataReadiness> {
  "use cache";
  cacheLife("hours");
  cacheTag(
    userTags.snapshots(userId),
    userTags.trades(userId),
    marketTags.assets,
    marketTags.ccl,
    marketTags.historicalPrices
  );

  const [snapshot, transactionCount, firstBuy, cclAgg, priceAgg, buys, assets] =
    await Promise.all([
      db.portfolioSnapshot.findFirst({ where: { userId }, select: { id: true } }),
      db.transaction.count({ where: { type: "BUY", userId } }),
      db.transaction.findFirst({
        where: { type: "BUY", userId },
        orderBy: { date: "asc" },
        select: { date: true },
      }),
      db.exchangeRate.aggregate({ _count: true, _min: { date: true } }),
      db.historicalPriceCache.aggregate({ _count: true, _min: { date: true } }),
      db.transaction.findMany({
        where: { type: "BUY", userId },
        select: { ticker: true, date: true },
      }),
      db.asset.findMany({ select: { ticker: true, underlyingTicker: true } }),
    ]);

  const oldestCclDate = cclAgg._min.date ?? null;
  const oldestHistoricalPriceDate = priceAgg._min.date ?? null;

  // Cobertura por ticker: ¿existe un precio histórico/CCL cerca de la primera compra?
  const priceByTicker = await db.historicalPriceCache.groupBy({
    by: ["ticker"],
    _min: { date: true },
  });
  const oldestPriceByUnderlying = new Map(
    priceByTicker.map((r) => [r.ticker, r._min.date ?? null])
  );
  const underlyingByTicker = new Map(assets.map((a) => [a.ticker, a.underlyingTicker]));

  const earliestBuyByTicker = new Map<string, Date>();
  for (const b of buys) {
    const current = earliestBuyByTicker.get(b.ticker);
    if (!current || b.date < current) earliestBuyByTicker.set(b.ticker, b.date);
  }

  const tickersMissingHistory: string[] = [];
  for (const [ticker, buyDate] of earliestBuyByTicker) {
    const underlying = underlyingByTicker.get(ticker);
    // Los instrumentos sin subyacente (bonos, acciones locales) quedan fuera del módulo.
    if (!underlying) continue;
    const oldestPrice = oldestPriceByUnderlying.get(underlying) ?? null;
    const priceMissing =
      !oldestPrice || daysAfter(oldestPrice, buyDate) > PRICE_TOLERANCE_DAYS;
    const cclMissing =
      !oldestCclDate || daysAfter(oldestCclDate, buyDate) > CCL_TOLERANCE_DAYS;
    if (priceMissing || cclMissing) tickersMissingHistory.push(underlying);
  }

  return {
    hasSnapshot: snapshot !== null,
    hasTransactions: transactionCount > 0,
    hasCclHistory: cclAgg._count,
    hasStockHistory: priceAgg._count,
    transactionCount,
    firstBuyDate: firstBuy?.date ?? null,
    needsBackfill: tickersMissingHistory.length > 0,
    tickersMissingHistory,
    oldestCclDate,
    oldestHistoricalPriceDate,
  };
}

// ---------------------------------------------------------------------------
// calculateRealGains
//
// Cálculo principal de los 3 métricas:
//   A) Ganancia real en USD (vía CCL histórico)
//   B) Ganancia por apreciación del subyacente (precio USD histórico)
//   C) Impacto CCL = A - B
// ---------------------------------------------------------------------------

export async function calculateRealGains(): Promise<RealGainsSummary | null> {
  return cachedRealGains(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017). Cruza
// datos del usuario con todo el historial de mercado, de ahí los seis tags.
async function cachedRealGains(userId: string): Promise<RealGainsSummary | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(
    userTags.snapshots(userId),
    userTags.trades(userId),
    marketTags.assets,
    marketTags.ccl,
    marketTags.historicalPrices,
    marketTags.marketPrices
  );

  // 1. Snapshot más reciente
  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotDate: "desc" },
    include: { positions: true },
  });

  if (!snapshot) return null;

  const cclActual = snapshot.ccl ? Number(snapshot.ccl) : null;

  // 2. Compras y ventas (las ventas descargan costo)
  const trades = await db.transaction.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    include: { movement: { select: { grossAmount: true } } },
  });

  if (!trades.some((t) => t.type === "BUY")) return null;
  const ratioChanges = await loadRatioChanges();

  // 3. Assets (para cedearRatio y underlyingTicker)
  const assets = await db.asset.findMany({
    select: { ticker: true, underlyingTicker: true, cedearRatio: true },
  });
  const assetMap = new Map(assets.map((a) => [a.ticker, a]));

  // 4. CCL histórico (todos los registros)
  const allCcl = await db.exchangeRate.findMany({
    orderBy: { date: "asc" },
    select: { date: true, ccl: true },
  });
  const cclHistory = allCcl.map((r) => ({
    date: r.date,
    value: Number(r.ccl),
  }));

  // 5. Precios históricos del subyacente (todos los registros)
  const allHistoricalPrices = await db.historicalPriceCache.findMany({
    orderBy: { date: "asc" },
  });
  // Agrupar por ticker
  const priceHistoryByTicker = new Map<string, { date: Date; value: number }[]>();
  for (const row of allHistoricalPrices) {
    const arr = priceHistoryByTicker.get(row.ticker) ?? [];
    arr.push({ date: row.date, value: Number(row.priceUsd) });
    priceHistoryByTicker.set(row.ticker, arr);
  }

  // 6. Precios actuales del subyacente
  const currentMarketPrices = await db.marketPriceCache.findMany();
  const currentPriceMap = new Map(
    currentMarketPrices.map((p) => [p.ticker, Number(p.price)])
  );

  // 7. Costo por ticker (lib/real-gains.ts), con las cantidades en CEDEARs del
  // ratio actual (ADR-0023): las acciones subyacentes usan el `cedearRatio` de hoy.
  const byTicker = costBasisByTicker(
    trades.map((t) =>
      adjustForRatioChanges(
        {
          ticker: t.ticker,
          type: t.type,
          date: t.date,
          quantity: Number(t.quantity),
          price: Number(t.price),
          currency: t.currency,
          fee: t.fee ? Number(t.fee) : null,
          movementGross: t.movement?.grossAmount != null ? Number(t.movement.grossAmount) : null,
        },
        ratioChanges
      )
    ),
    {
      cclNear: (date) => {
        const hit = findNearest(cclHistory, date, CCL_TOLERANCE_DAYS);
        return hit ? { value: hit.value, exact: Math.abs(hit.date.getTime() - date.getTime()) <= 1000 * 60 * 60 * 24 } : null;
      },
      stockPriceNear: (ticker, date) => {
        const underlying = assetMap.get(ticker)?.underlyingTicker;
        if (!underlying) return null;
        return findNearest(priceHistoryByTicker.get(underlying) ?? [], date, PRICE_TOLERANCE_DAYS)?.value ?? null;
      },
      cedearRatio: (ticker) => {
        const asset = assetMap.get(ticker);
        return asset?.underlyingTicker ? Number(asset.cedearRatio) : null;
      },
    }
  );

  // 8. Construir posiciones combinando costos con posiciones del snapshot
  const positionMap = new Map(snapshot.positions.map((p) => [p.ticker, p]));
  const positions: PositionGains[] = [];

  let totalCostArs = 0;
  let totalCostUsdCcl: number | null = 0;
  let totalCostUsdStock: number | null = 0;
  let totalValueArs = 0;
  let totalValueUsdCcl: number | null = 0;
  let totalValueUsdStock: number | null = 0;
  let positionsWithFullData = 0;

  for (const [ticker, cost] of byTicker.entries()) {
    const pos = positionMap.get(ticker);
    if (!pos) continue;

    const asset = assetMap.get(ticker);
    // Sólo se descompone la ganancia de instrumentos con subyacente (CEDEARs).
    // Bonos y acciones locales (ej: T661O, VALO) quedan fuera del módulo.
    if (!asset?.underlyingTicker) continue;
    const underlyingTicker = asset.underlyingTicker;
    const cedearRatio = Number(asset.cedearRatio);

    const quantity = Number(pos.quantity);
    const valueArs = Number(pos.positionValue);

    // Valor actual en USD — Método A (vía CCL actual)
    const valueUsdCcl =
      cclActual && cclActual > 0 ? valueArs / cclActual : null;

    // Valor actual en USD — Método B (precio actual del subyacente)
    const currentUsdPrice = underlyingTicker
      ? (currentPriceMap.get(underlyingTicker) ?? null)
      : null;
    const valueUsdStock =
      currentUsdPrice && cedearRatio > 0
        ? (quantity / cedearRatio) * currentUsdPrice
        : null;

    // Ganancias
    const gainArs = valueArs - cost.costArs;

    const gainUsdReal =
      valueUsdCcl !== null && cost.costUsdCcl !== null
        ? valueUsdCcl - cost.costUsdCcl
        : null;

    const gainUsdAppreciation =
      valueUsdStock !== null && cost.costUsdStock !== null
        ? valueUsdStock - cost.costUsdStock
        : null;

    const gainUsdCclImpact =
      gainUsdReal !== null && gainUsdAppreciation !== null
        ? gainUsdReal - gainUsdAppreciation
        : null;

    // Porcentajes
    const gainPctArs =
      cost.costArs > 0 ? (gainArs / cost.costArs) * 100 : null;
    const gainPctUsdReal =
      cost.costUsdCcl && cost.costUsdCcl > 0 && gainUsdReal !== null
        ? (gainUsdReal / cost.costUsdCcl) * 100
        : null;
    const gainPctUsdAppreciation =
      cost.costUsdStock && cost.costUsdStock > 0 && gainUsdAppreciation !== null
        ? (gainUsdAppreciation / cost.costUsdStock) * 100
        : null;

    const hasFullData =
      gainUsdReal !== null && gainUsdAppreciation !== null;
    if (hasFullData) positionsWithFullData++;

    // Razón de datos faltantes (para el panel de diagnóstico)
    let missingReason: string | null = null;
    if (!hasFullData) {
      if (!priceHistoryByTicker.has(underlyingTicker)) {
        missingReason = "Sin precios históricos en cache — ejecutá el Paso 2 del wizard";
      } else if (!currentUsdPrice) {
        missingReason = "Sin precio actual en Yahoo Finance — actualizá precios en Assets";
      } else if (gainUsdAppreciation === null) {
        missingReason = "Sin precio histórico en la fecha de compra (±3 días)";
      } else if (gainUsdReal === null) {
        missingReason = "Sin CCL disponible para la fecha de compra (±7 días)";
      }
    }

    // Acumular totales
    totalCostArs += cost.costArs;
    if (cost.costUsdCcl !== null && totalCostUsdCcl !== null)
      totalCostUsdCcl += cost.costUsdCcl;
    else totalCostUsdCcl = null;

    if (cost.costUsdStock !== null && totalCostUsdStock !== null)
      totalCostUsdStock += cost.costUsdStock;
    else totalCostUsdStock = null;

    totalValueArs += valueArs;
    if (valueUsdCcl !== null && totalValueUsdCcl !== null)
      totalValueUsdCcl += valueUsdCcl;
    else if (totalValueUsdCcl === 0 && valueUsdCcl !== null)
      totalValueUsdCcl = valueUsdCcl;

    if (valueUsdStock !== null && totalValueUsdStock !== null)
      totalValueUsdStock += valueUsdStock;
    else if (totalValueUsdStock === 0 && valueUsdStock !== null)
      totalValueUsdStock = valueUsdStock;

    positions.push({
      ticker,
      underlyingTicker,
      quantity,
      cedearRatio,
      costArs: cost.costArs,
      costUsdCcl: cost.costUsdCcl,
      costUsdStock: cost.costUsdStock,
      valueArs,
      valueUsdCcl,
      valueUsdStock,
      gainArs,
      gainUsdReal,
      gainUsdAppreciation,
      gainUsdCclImpact,
      gainPctArs,
      gainPctUsdReal,
      gainPctUsdAppreciation,
      cclApproximate: cost.cclApproximate,
      stockPriceAvailable: cost.stockPriceAvailable,
      missingReason,
    });
  }

  // Totales del portfolio
  const totalGainArs = totalValueArs - totalCostArs;
  const totalGainUsdReal =
    totalValueUsdCcl !== null && totalCostUsdCcl !== null
      ? totalValueUsdCcl - totalCostUsdCcl
      : null;
  const totalGainUsdAppreciation =
    totalValueUsdStock !== null && totalCostUsdStock !== null
      ? totalValueUsdStock - totalCostUsdStock
      : null;
  const totalGainUsdCclImpact =
    totalGainUsdReal !== null && totalGainUsdAppreciation !== null
      ? totalGainUsdReal - totalGainUsdAppreciation
      : null;

  const totalGainPctArs =
    totalCostArs > 0 ? (totalGainArs / totalCostArs) * 100 : null;
  const totalGainPctUsdReal =
    totalCostUsdCcl && totalCostUsdCcl > 0 && totalGainUsdReal !== null
      ? (totalGainUsdReal / totalCostUsdCcl) * 100
      : null;
  const totalGainPctUsdAppreciation =
    totalCostUsdStock && totalCostUsdStock > 0 && totalGainUsdAppreciation !== null
      ? (totalGainUsdAppreciation / totalCostUsdStock) * 100
      : null;

  const cclHits = Array.from(byTicker.values()).reduce((s, v) => s + v.cclHits, 0);
  const cclTransactions = cclHits + Array.from(byTicker.values()).reduce((s, v) => s + v.cclMisses, 0);
  const cclCoverage = cclTransactions > 0 ? (cclHits / cclTransactions) * 100 : 0;

  return {
    positions: positions.sort((a, b) => (b.gainArs ?? 0) - (a.gainArs ?? 0)),
    totalCostArs,
    totalCostUsdCcl,
    totalCostUsdStock,
    totalValueArs,
    totalValueUsdCcl,
    totalValueUsdStock,
    totalGainArs,
    totalGainUsdReal,
    totalGainUsdAppreciation,
    totalGainUsdCclImpact,
    totalGainPctArs,
    totalGainPctUsdReal,
    totalGainPctUsdAppreciation,
    positionsWithFullData,
    positionsTotal: positions.length,
    cclCoverage,
  };
}
