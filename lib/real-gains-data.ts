import { db } from "@/lib/db";

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
};

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
  const [snapshot, transactionCount, firstBuy, cclCount, stockHistoryCount] =
    await Promise.all([
      db.portfolioSnapshot.findFirst({ select: { id: true } }),
      db.transaction.count({ where: { type: "BUY" } }),
      db.transaction.findFirst({
        where: { type: "BUY" },
        orderBy: { date: "asc" },
        select: { date: true },
      }),
      db.exchangeRate.count(),
      db.historicalPriceCache.count(),
    ]);

  return {
    hasSnapshot: snapshot !== null,
    hasTransactions: transactionCount > 0,
    hasCclHistory: cclCount,
    hasStockHistory: stockHistoryCount,
    transactionCount,
    firstBuyDate: firstBuy?.date ?? null,
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
  // 1. Snapshot más reciente
  const snapshot = await db.portfolioSnapshot.findFirst({
    orderBy: { snapshotDate: "desc" },
    include: { positions: true },
  });

  if (!snapshot) return null;

  const cclActual = snapshot.ccl ? Number(snapshot.ccl) : null;

  // 2. Transacciones BUY
  const buys = await db.transaction.findMany({
    where: { type: "BUY" },
    orderBy: { date: "asc" },
  });

  if (buys.length === 0) return null;

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

  // 7. Agrupar BUYs por ticker para calcular costo acumulado
  type TickerCost = {
    costArs: number;
    costUsdCcl: number | null;
    costUsdStock: number | null;
    totalQty: number;
    cclApproximate: boolean;
    stockPriceAvailable: boolean;
    cclHits: number;
    cclMisses: number;
  };

  const byTicker = new Map<string, TickerCost>();

  for (const buy of buys) {
    const qty = Number(buy.quantity);
    const price = Number(buy.price);
    const costArs = qty * price + (buy.fee ? Number(buy.fee) : 0);

    // CCL en fecha de compra (Método A)
    const cclAtBuy = findNearest(cclHistory, buy.date, 7);
    const costUsdCclTx = cclAtBuy ? costArs / cclAtBuy.value : null;

    // Precio USD del subyacente en fecha de compra (Método B)
    const asset = assetMap.get(buy.ticker);
    const underlyingTicker = asset?.underlyingTicker ?? null;
    const cedearRatio = asset ? Number(asset.cedearRatio) : 1;

    let costUsdStockTx: number | null = null;
    if (underlyingTicker && cedearRatio > 0) {
      const priceHistory = priceHistoryByTicker.get(underlyingTicker) ?? [];
      const priceAtBuy = findNearest(priceHistory, buy.date, 5);
      if (priceAtBuy) {
        costUsdStockTx = (qty / cedearRatio) * priceAtBuy.value;
      }
    }

    const existing = byTicker.get(buy.ticker);
    if (existing) {
      existing.costArs += costArs;
      existing.costUsdCcl =
        existing.costUsdCcl !== null && costUsdCclTx !== null
          ? existing.costUsdCcl + costUsdCclTx
          : existing.costUsdCcl ?? costUsdCclTx;
      existing.costUsdStock =
        existing.costUsdStock !== null && costUsdStockTx !== null
          ? existing.costUsdStock + costUsdStockTx
          : existing.costUsdStock ?? costUsdStockTx;
      existing.totalQty += qty;
      if (!cclAtBuy) existing.cclMisses++;
      else existing.cclHits++;
      if (!costUsdStockTx) existing.stockPriceAvailable = false;
    } else {
      byTicker.set(buy.ticker, {
        costArs,
        costUsdCcl: costUsdCclTx,
        costUsdStock: costUsdStockTx,
        totalQty: qty,
        cclApproximate: cclAtBuy
          ? Math.abs(cclAtBuy.date.getTime() - buy.date.getTime()) > 1000 * 60 * 60 * 24
          : true,
        stockPriceAvailable: costUsdStockTx !== null,
        cclHits: cclAtBuy ? 1 : 0,
        cclMisses: cclAtBuy ? 0 : 1,
      });
    }
  }

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
    const underlyingTicker = asset?.underlyingTicker ?? null;
    const cedearRatio = asset ? Number(asset.cedearRatio) : 1;

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
      if (!underlyingTicker) {
        missingReason = "Sin underlyingTicker configurado en Assets";
      } else if (!priceHistoryByTicker.has(underlyingTicker)) {
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

  const cclTransactions = buys.length;
  const cclHits = Array.from(byTicker.values()).reduce((s, v) => s + v.cclHits, 0);
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
