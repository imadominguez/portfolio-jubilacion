"use server";

import { cacheLife, cacheTag } from "next/cache";
import { revalidateTrades } from "@/lib/revalidate";
import { userTags } from "@/lib/cache-tags";
import { getDataReadiness } from "@/lib/real-gains-data";
import { db } from "@/lib/db";
import { requireAuth, requireUserId } from "@/lib/auth-session";
import {
  isTradeCategory,
  type MovementCategory,
  type ParsedMovement,
} from "@/lib/cocos-movements";
import type { Currency } from "@/app/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportMovementsResult =
  | {
      success: true;
      imported: number;
      transactionsCreated: number;
      duplicates: number;
      byCategory: Record<MovementCategory, number>;
      historyBackfillNeeded: boolean;
    }
  | { success: false; error: string };

export type MovementRow = {
  id: string;
  date: Date;
  rawType: string;
  category: MovementCategory;
  instrument: string | null;
  ticker: string | null;
  currency: Currency;
  quantity: number | null;
  price: number | null;
  total: number;
  sourceFile: string | null;
  transactionId: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function tradeFee(m: ParsedMovement): number {
  const fee =
    Math.abs(m.commission ?? 0) +
    Math.abs(m.ddmm ?? 0) +
    Math.abs(m.iva ?? 0) +
    Math.abs(m.other ?? 0);
  return Math.round(fee * 100) / 100;
}

function toMovementData(m: ParsedMovement, userId: string, sourceFile?: string) {
  return {
    nroTicket: m.nroTicket,
    nroComprobante: m.nroComprobante,
    date: toDate(m.date),
    settlementDate: m.settlementDate ? toDate(m.settlementDate) : null,
    rawType: m.rawType,
    category: m.category,
    instrument: m.instrument,
    ticker: m.ticker,
    currency: m.currency as Currency,
    market: m.market,
    quantity: m.quantity,
    price: m.price,
    grossAmount: m.grossAmount,
    commission: m.commission,
    ddmm: m.ddmm,
    iva: m.iva,
    other: m.other,
    total: m.total,
    sourceFile: sourceFile ?? null,
    userId,
  };
}

function emptyCounts(): Record<MovementCategory, number> {
  return {
    TRADE_BUY: 0,
    TRADE_SELL: 0,
    FCI_SUBSCRIPTION: 0,
    FCI_REDEMPTION: 0,
    PAYMENT: 0,
    RECEIPT: 0,
    DIVIDEND: 0,
    DIVIDEND_IN_KIND: 0,
    CONVERSION: 0,
    OTHER: 0,
  };
}

// ---------------------------------------------------------------------------
// importMovements — persiste el libro de movimientos (idempotente) y crea
// las Transaction correspondientes a las operaciones de compra/venta.
// ---------------------------------------------------------------------------

export async function importMovements(
  movements: ParsedMovement[],
  sourceFile?: string
): Promise<ImportMovementsResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    if (movements.length === 0) {
      return { success: false, error: "No hay movimientos para importar." };
    }

    const tickets = movements.map((m) => m.nroTicket);

    // Dedup por libro de movimientos + compatibilidad con transacciones legacy
    // (importadas antes del refactor, identificadas por notes = "Cocos #<ticket>").
    const [existingMovements, legacyTransactions] = await Promise.all([
      db.movement.findMany({
        where: { userId, nroTicket: { in: tickets } },
        select: { nroTicket: true },
      }),
      db.transaction.findMany({
        where: { userId, notes: { in: tickets.map((t) => `Cocos #${t}`) } },
        select: { notes: true },
      }),
    ]);

    const seen = new Set(existingMovements.map((m) => m.nroTicket));
    for (const t of legacyTransactions) {
      if (t.notes) seen.add(t.notes.replace(/^Cocos #/, ""));
    }

    const toInsert = movements.filter((m) => !seen.has(m.nroTicket));
    const duplicates = movements.length - toInsert.length;

    if (toInsert.length === 0) {
      const readiness = await getDataReadiness();
      return {
        success: true,
        imported: 0,
        transactionsCreated: 0,
        duplicates,
        byCategory: emptyCounts(),
        historyBackfillNeeded: readiness.needsBackfill,
      };
    }

    const byCategory = emptyCounts();

    const transactionsCreated = await db.$transaction(async (tx) => {
      let created;
      try {
        created = await tx.movement.createManyAndReturn({
          data: toInsert.map((m) => toMovementData(m, userId, sourceFile)),
          skipDuplicates: true,
        });
      } catch {
        // Fallback para adapters que no soportan createManyAndReturn.
        created = [];
        for (const m of toInsert) {
          const row = await tx.movement.create({ data: toMovementData(m, userId, sourceFile) });
          created.push(row);
        }
      }

      const tradeRows = created
        .filter((row) => isTradeCategory(row.category as MovementCategory))
        .filter((row) => row.ticker && row.quantity && row.price)
        .map((row) => {
          const source = toInsert.find((m) => m.nroTicket === row.nroTicket)!;
          return {
            ticker: row.ticker!,
            type: row.category === "TRADE_BUY" ? ("BUY" as const) : ("SELL" as const),
            quantity: row.quantity!,
            price: row.price!,
            currency: row.currency as Currency,
            fee: tradeFee(source) > 0 ? tradeFee(source) : null,
            date: row.date,
            notes: `Cocos #${row.nroTicket}`,
            userId,
            movementId: row.id,
          };
        });

      if (tradeRows.length > 0) {
        await tx.transaction.createMany({ data: tradeRows });
      }

      for (const row of created) {
        byCategory[row.category as MovementCategory]++;
      }

      return tradeRows.length;
    });

    revalidateTrades(session.user.id);

    const readiness = await getDataReadiness();

    return {
      success: true,
      imported: toInsert.length,
      transactionsCreated,
      duplicates,
      byCategory,
      historyBackfillNeeded: readiness.needsBackfill,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al importar.";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// getMovements — lectura del libro de movimientos para las vistas.
// ---------------------------------------------------------------------------

export async function getMovements(categories?: MovementCategory[]): Promise<MovementRow[]> {
  return cachedMovements(await requireUserId(), categories);
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017). Las
// categorías forman parte de la clave del caché.
async function cachedMovements(
  userId: string,
  categories?: MovementCategory[]
): Promise<MovementRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.trades(userId));

  const movements = await db.movement.findMany({
    where: {
      userId,
      ...(categories && categories.length > 0 ? { category: { in: categories } } : {}),
    },
    orderBy: { date: "desc" },
    include: { transaction: { select: { id: true } } },
  });

  return movements.map((m) => ({
    id: m.id,
    date: m.date,
    rawType: m.rawType,
    category: m.category as MovementCategory,
    instrument: m.instrument,
    ticker: m.ticker,
    currency: m.currency as Currency,
    quantity: m.quantity !== null ? Number(m.quantity) : null,
    price: m.price !== null ? Number(m.price) : null,
    total: Number(m.total),
    sourceFile: m.sourceFile,
    transactionId: m.transaction?.id ?? null,
  }));
}
