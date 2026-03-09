"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkAndUpdateMilestones } from "@/app/actions/milestones";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedPosition = {
  ticker: string;
  instrumentName: string;
  quantity: number;
  price: number;
  positionValue: number;
  allocationPct: number;
};

export type PreviewResult =
  | { success: true; positions: ParsedPosition[]; totalValueArs: number }
  | { success: false; error: string };

export type ImportResult =
  | { success: true; snapshotId: string; positionCount: number }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// CSV parsing — Cocos Capital format
//
// Format: instrumento,cantidad,precio,moneda,total
// Ticker: extracted from instrumento via regex \(([A-Z0-9]+)\)
// Separator: comma
// ---------------------------------------------------------------------------

function extractTicker(instrumento: string): string | null {
  const match = instrumento.match(/\(([A-Z0-9]+)\)/);
  return match ? match[1] : null;
}

function parseNumber(raw: string): number {
  // Remove currency symbols, spaces, dots used as thousands separators
  // then replace comma decimal separator with dot
  const cleaned = raw.trim().replace(/[$ ]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function detectDelimiter(headerLine: string): string {
  // Count occurrences of common delimiters in the header line
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseCocosCapitalCsv(csvText: string): ParsedPosition[] | string {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return "El archivo está vacío o no tiene filas de datos.";
  }

  // Strip BOM and auto-detect delimiter
  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(firstLine);

  // Normalize headers to lowercase, strip quotes
  const rawHeaders = firstLine
    .split(delimiter)
    .map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  const idx = {
    instrumento: rawHeaders.indexOf("instrumento"),
    cantidad: rawHeaders.indexOf("cantidad"),
    precio: rawHeaders.indexOf("precio"),
    moneda: rawHeaders.indexOf("moneda"),
    total: rawHeaders.indexOf("total"),
  };

  if (idx.instrumento === -1 || idx.cantidad === -1 || idx.total === -1) {
    return `Columnas no reconocidas. Encontradas: ${rawHeaders.join(", ")}. Se esperan: instrumento, cantidad, precio, moneda, total.`;
  }

  const positions: Omit<ParsedPosition, "allocationPct">[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));

    const instrumento = cols[idx.instrumento] ?? "";
    const ticker = extractTicker(instrumento);
    if (!ticker) continue; // skip rows without a valid ticker in parentheses

    const cantidad = parseNumber(cols[idx.cantidad] ?? "0");
    if (cantidad <= 0) continue;

    const precio = idx.precio !== -1 ? parseNumber(cols[idx.precio] ?? "0") : 0;
    const total = parseNumber(cols[idx.total] ?? "0");
    const positionValue = total > 0 ? total : cantidad * precio;

    positions.push({
      ticker,
      instrumentName: instrumento,
      quantity: cantidad,
      price: precio,
      positionValue,
    });
  }

  if (positions.length === 0) {
    return "No se encontraron posiciones válidas. Verificá que el archivo sea un CSV exportado desde Cocos Capital.";
  }

  const totalValueArs = positions.reduce((sum, p) => sum + p.positionValue, 0);

  return positions.map((p) => ({
    ...p,
    allocationPct: totalValueArs > 0 ? p.positionValue / totalValueArs : 0,
  }));
}

// ---------------------------------------------------------------------------
// parseSnapshotPreview — parse CSV and return positions WITHOUT saving to DB
// ---------------------------------------------------------------------------

export async function parseSnapshotPreview(
  formData: FormData
): Promise<PreviewResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "No se adjuntó ningún archivo." };

    const csvText = await file.text();
    const result = parseCocosCapitalCsv(csvText);

    if (typeof result === "string") {
      return { success: false, error: result };
    }

    const totalValueArs = result.reduce((sum, p) => sum + p.positionValue, 0);
    return { success: true, positions: result, totalValueArs };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al leer el archivo.";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// importSnapshot — parse CSV and persist to DB (immutable snapshot)
// ---------------------------------------------------------------------------

export async function importSnapshot(formData: FormData): Promise<ImportResult> {
  try {
    const file = formData.get("file") as File | null;
    const dateStr = formData.get("date") as string | null;
    const cclStr = formData.get("ccl") as string | null;

    if (!file) return { success: false, error: "No se adjuntó ningún archivo." };
    if (!dateStr) return { success: false, error: "La fecha es obligatoria." };

    const snapshotDate = new Date(dateStr);
    if (isNaN(snapshotDate.getTime())) {
      return { success: false, error: "La fecha ingresada no es válida." };
    }

    const csvText = await file.text();
    const parsed = parseCocosCapitalCsv(csvText);

    if (typeof parsed === "string") {
      return { success: false, error: parsed };
    }

    const totalValueArs = parsed.reduce((sum, p) => sum + p.positionValue, 0);
    const ccl = cclStr ? parseFloat(cclStr.replace(",", ".")) : null;
    const totalValueUsd = ccl && ccl > 0 ? totalValueArs / ccl : null;

    const existing = await db.portfolioSnapshot.findUnique({
      where: { snapshotDate },
      select: { id: true },
    });

    if (existing) {
      return {
        success: false,
        error: `Ya existe un snapshot para la fecha ${dateStr}. Los snapshots son inmutables y no pueden sobreescribirse.`,
      };
    }

    const snapshot = await db.portfolioSnapshot.create({
      data: {
        snapshotDate,
        totalValueArs,
        totalValueUsd,
        ccl,
        sourceFile: file.name,
        positions: {
          create: parsed.map((p) => ({
            ticker: p.ticker,
            instrumentName: p.instrumentName || null,
            quantity: p.quantity,
            price: p.price,
            positionValue: p.positionValue,
            allocationPct: p.allocationPct,
          })),
        },
      },
    });

    revalidatePath("/");
    revalidatePath("/snapshots");
    revalidatePath("/performance");

    if (totalValueUsd && totalValueUsd > 0) {
      await checkAndUpdateMilestones(totalValueUsd);
    }

    return { success: true, snapshotId: snapshot.id, positionCount: parsed.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteSnapshot(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.portfolioSnapshot.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/snapshots");
    revalidatePath("/performance");
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar el snapshot." };
  }
}
