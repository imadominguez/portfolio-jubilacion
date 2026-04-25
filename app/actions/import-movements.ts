"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-session";
import type { TransactionType, Currency } from "@/app/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MovimientoRow = {
  nroTicket: string;
  date: string;
  type: TransactionType;
  ticker: string;
  instrumento: string;
  quantity: number;
  price: number;
  currency: Currency;
  fee: number;
  total: number;
};

export type ParsedMovimientos = {
  rows: MovimientoRow[];
  skippedCount: number;
  skippedReasons: { fci: number; pagos: number; dividendos: number; mep: number; other: number };
};

export type ImportMovimientosResult =
  | { success: true; imported: number; duplicates: number }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArNumber(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  // Argentine format: dot = thousands sep, comma = decimal sep
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDateDDMMYYYY(raw: string): string {
  // Input: "08-04-2025" → output: "2025-04-08"
  const parts = raw.trim().split("-");
  if (parts.length !== 3) return raw;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
}

function extractTicker(instrumento: string): string | null {
  const match = instrumento.match(/\(([A-Z0-9]+)\)/);
  return match ? match[1] : null;
}

function classifyTipoOperacion(tipo: string): "BUY" | "SELL" | "SKIP_FCI" | "SKIP_PAGO" | "SKIP_DIVIDENDO" | "SKIP_MEP" | "SKIP_OTHER" {
  const t = tipo.trim();
  if (t === "Compra") return "BUY";
  if (t === "Venta") return "SELL";
  if (t.includes("Fci") || t.includes("FCI")) return "SKIP_FCI";
  if (t === "Orden De Pago" || t === "Recibo De Cobro") return "SKIP_PAGO";
  if (t === "DIVIDENDOS EN ESPECIE" || t === "Dividendos") return "SKIP_DIVIDENDO";
  if (t.includes("bono") || t.includes("MEP") || t.includes("Nota De Credito")) return "SKIP_MEP";
  return "SKIP_OTHER";
}

// ---------------------------------------------------------------------------
// parseCocosMovimientosCsv — pure parse, no DB access
// ---------------------------------------------------------------------------

export async function parseCocosMovimientosCsv(csvText: string): Promise<ParsedMovimientos | { error: string }> {
  try {
    const lines = csvText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return { error: "El archivo está vacío o no tiene filas de datos." };
    }

    // Strip BOM
    const headerLine = lines[0].replace(/^\uFEFF/, "");
    const headers = headerLine.split(";").map((h) => h.trim().toLowerCase());

    const idx = {
      nroTicket: headers.indexOf("nroticket"),
      fechaEjecucion: headers.indexOf("fechaejecucion"),
      tipoOperacion: headers.indexOf("tipooperacion"),
      instrumento: headers.indexOf("instrumento"),
      moneda: headers.indexOf("moneda"),
      cantidad: headers.indexOf("cantidad"),
      precio: headers.indexOf("precio"),
      montoBruto: headers.indexOf("montobruto"),
      comision: headers.indexOf("comision"),
      ddmm: headers.indexOf("ddmm"),
      iva: headers.indexOf("iva"),
      otros: headers.indexOf("otros"),
      total: headers.indexOf("total"),
    };

    if (idx.tipoOperacion === -1 || idx.instrumento === -1 || idx.cantidad === -1) {
      return {
        error: `Columnas no reconocidas. ¿Es un CSV de movimientos de Cocos Capital? Columnas encontradas: ${headers.join(", ")}`,
      };
    }

    const rows: MovimientoRow[] = [];
    const skipped = { fci: 0, pagos: 0, dividendos: 0, mep: 0, other: 0 };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      const get = (colIdx: number) => (colIdx !== -1 ? cols[colIdx] ?? "" : "");

      const tipo = get(idx.tipoOperacion);
      const classification = classifyTipoOperacion(tipo);

      if (classification !== "BUY" && classification !== "SELL") {
        if (classification === "SKIP_FCI") skipped.fci++;
        else if (classification === "SKIP_PAGO") skipped.pagos++;
        else if (classification === "SKIP_DIVIDENDO") skipped.dividendos++;
        else if (classification === "SKIP_MEP") skipped.mep++;
        else skipped.other++;
        continue;
      }

      const instrumento = get(idx.instrumento);
      const ticker = extractTicker(instrumento);
      if (!ticker) {
        skipped.other++;
        continue;
      }

      const monedaRaw = get(idx.moneda).trim().toUpperCase();
      const currency: Currency = monedaRaw === "USD" ? "USD" : "ARS";

      const cantidad = Math.abs(parseArNumber(get(idx.cantidad)));
      const precio = parseArNumber(get(idx.precio));
      const fee =
        Math.abs(parseArNumber(get(idx.comision))) +
        Math.abs(parseArNumber(get(idx.ddmm))) +
        Math.abs(parseArNumber(get(idx.iva))) +
        Math.abs(parseArNumber(get(idx.otros)));
      const total = parseArNumber(get(idx.total));

      rows.push({
        nroTicket: get(idx.nroTicket),
        date: parseDateDDMMYYYY(get(idx.fechaEjecucion)),
        type: classification,
        ticker,
        instrumento,
        quantity: cantidad,
        price: precio,
        currency,
        fee: Math.round(fee * 100) / 100,
        total,
      });
    }

    return {
      rows,
      skippedCount: skipped.fci + skipped.pagos + skipped.dividendos + skipped.mep + skipped.other,
      skippedReasons: skipped,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al parsear el archivo.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// importMovimientos — bulk insert, skipping duplicates by nroTicket
// ---------------------------------------------------------------------------

export async function importMovimientos(rows: MovimientoRow[]): Promise<ImportMovimientosResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    if (rows.length === 0) {
      return { success: false, error: "No hay transacciones para importar." };
    }

    // Fetch existing nroTickets from notes to detect duplicates
    const existingNotes = await db.transaction.findMany({
      where: {
        userId,
        notes: { in: rows.map((r) => `Cocos #${r.nroTicket}`) },
      },
      select: { notes: true },
    });

    const existingTicketSet = new Set(existingNotes.map((t) => t.notes));

    const toInsert = rows.filter((r) => !existingTicketSet.has(`Cocos #${r.nroTicket}`));
    const duplicates = rows.length - toInsert.length;

    if (toInsert.length === 0) {
      return { success: true, imported: 0, duplicates };
    }

    await db.transaction.createMany({
      data: toInsert.map((r) => ({
        ticker: r.ticker,
        type: r.type,
        quantity: r.quantity,
        price: r.price,
        currency: r.currency,
        fee: r.fee > 0 ? r.fee : null,
        date: new Date(r.date),
        notes: `Cocos #${r.nroTicket}`,
        userId,
      })),
    });

    revalidatePath("/transactions");
    revalidatePath("/");

    return { success: true, imported: toInsert.length, duplicates };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al importar.";
    return { success: false, error: message };
  }
}
