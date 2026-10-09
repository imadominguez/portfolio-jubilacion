"use server";

import { revalidatePortfolioData } from "@/lib/revalidate";
import { db } from "@/lib/db";
import { requireAuth, requireUserId } from "@/lib/auth-session";
import { checkAndUpdateMilestones } from "@/app/actions/milestones";
import { parseCocosNumber } from "@/lib/number-parsing";
import { getSetupStatus } from "@/app/actions/setup";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedPosition = {
  ticker: string;
  instrumentName: string;
  quantity: number;
  price: number;
  // positionValue está expresado en la moneda original de la posición (currency).
  positionValue: number;
  currency: "ARS" | "USD";
  allocationPct: number;
};

export type PreviewResult =
  | {
      success: true;
      positions: ParsedPosition[];
      totalValueArs: number;
      hasUsdPositions: boolean;
      missingCcl: boolean;
    }
  | { success: false; error: string };

export type NextSetupStep = { label: string; href: string; ctaLabel: string };

export type ImportResult =
  | {
      success: true;
      snapshotId: string;
      positionCount: number;
      totalValueArs: number;
      /** Primer paso pendiente del checklist que el usuario puede resolver. */
      nextStep: NextSetupStep | null;
    }
  | { success: false; error: string };

function duplicateDateError(dateStr: string): string {
  return `Ya existe un snapshot para la fecha ${dateStr}. Los snapshots no se sobreescriben: si el anterior está mal, eliminalo desde su detalle y volvé a importar.`;
}

async function snapshotExists(userId: string, snapshotDate: Date): Promise<boolean> {
  const existing = await db.portfolioSnapshot.findFirst({
    where: { snapshotDate, userId },
    select: { id: true },
  });
  return existing !== null;
}

// Se consulta al elegir la fecha, para avisar del duplicado antes de revisar
// la previsualización (la validación definitiva sigue en importSnapshot).
export async function checkSnapshotDate(
  dateStr: string
): Promise<{ success: true; exists: boolean } | { success: false; error: string }> {
  try {
    const userId = await requireUserId();
    const snapshotDate = new Date(dateStr);
    if (isNaN(snapshotDate.getTime())) {
      return { success: false, error: "La fecha ingresada no es válida." };
    }
    return { success: true, exists: await snapshotExists(userId, snapshotDate) };
  } catch {
    return { success: false, error: "No se pudo verificar la fecha." };
  }
}

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

function detectDelimiter(headerLine: string): string {
  // Count occurrences of common delimiters in the header line
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

type RawParsedPosition = Omit<ParsedPosition, "allocationPct">;

function parseCocosCapitalCsv(csvText: string): RawParsedPosition[] | string {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return "El archivo está vacío o no tiene filas de datos.";
  }

  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(firstLine);

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

  const positions: RawParsedPosition[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));

    const instrumento = cols[idx.instrumento] ?? "";
    const ticker = extractTicker(instrumento);
    if (!ticker) continue;

    const cantidad = parseCocosNumber(cols[idx.cantidad] ?? "0");
    if (cantidad <= 0) continue;

    const precio = idx.precio !== -1 ? parseCocosNumber(cols[idx.precio] ?? "0") : 0;
    const total = parseCocosNumber(cols[idx.total] ?? "0");
    const positionValue = total > 0 ? total : cantidad * precio;

    const monedaRaw =
      idx.moneda !== -1 ? (cols[idx.moneda] ?? "").toUpperCase() : "ARS";
    const currency: "ARS" | "USD" = monedaRaw === "USD" ? "USD" : "ARS";

    positions.push({
      ticker,
      instrumentName: instrumento,
      quantity: cantidad,
      price: precio,
      positionValue,
      currency,
    });
  }

  if (positions.length === 0) {
    return "No se encontraron posiciones válidas. Verificá que el archivo sea un CSV exportado desde Cocos Capital.";
  }

  return positions;
}

// ---------------------------------------------------------------------------
// computeTotalsAndAllocations
//
// Aplica el CCL para convertir las posiciones USD a ARS, calcula el total
// del portfolio en ARS y asigna allocationPct sobre el equivalente ARS.
// Si no hay CCL pero hay posiciones USD, esas se omiten del total ARS y
// reciben allocationPct = 0 (el caller debe avisar al usuario).
// ---------------------------------------------------------------------------

function computeTotalsAndAllocations(
  raw: RawParsedPosition[],
  ccl: number | null
): { positions: ParsedPosition[]; totalValueArs: number; hasUsdPositions: boolean } {
  const hasUsdPositions = raw.some((p) => p.currency === "USD");

  const arsEquivalent = (p: RawParsedPosition): number => {
    if (p.currency === "ARS") return p.positionValue;
    if (ccl && ccl > 0) return p.positionValue * ccl;
    return 0;
  };

  const totalValueArs = raw.reduce((sum, p) => sum + arsEquivalent(p), 0);

  const positions: ParsedPosition[] = raw.map((p) => ({
    ...p,
    allocationPct: totalValueArs > 0 ? arsEquivalent(p) / totalValueArs : 0,
  }));

  return { positions, totalValueArs, hasUsdPositions };
}

// ---------------------------------------------------------------------------
// parseSnapshotPreview — parse CSV and return positions WITHOUT saving to DB
// ---------------------------------------------------------------------------

export async function parseSnapshotPreview(
  formData: FormData
): Promise<PreviewResult> {
  try {
    const userId = await requireUserId();
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "No se adjuntó ningún archivo." };

    const dateStr = formData.get("date") as string | null;
    if (dateStr) {
      const snapshotDate = new Date(dateStr);
      if (!isNaN(snapshotDate.getTime()) && (await snapshotExists(userId, snapshotDate))) {
        return { success: false, error: duplicateDateError(dateStr) };
      }
    }

    const cclStr = formData.get("ccl") as string | null;
    const ccl = cclStr ? parseFloat(cclStr.replace(",", ".")) : null;
    const validCcl = ccl && ccl > 0 ? ccl : null;

    const csvText = await file.text();
    const raw = parseCocosCapitalCsv(csvText);

    if (typeof raw === "string") {
      return { success: false, error: raw };
    }

    const { positions, totalValueArs, hasUsdPositions } =
      computeTotalsAndAllocations(raw, validCcl);

    return {
      success: true,
      positions,
      totalValueArs,
      hasUsdPositions,
      missingCcl: hasUsdPositions && !validCcl,
    };
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
    const session = await requireAuth();
    const userId = session.user.id;

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
    const raw = parseCocosCapitalCsv(csvText);

    if (typeof raw === "string") {
      return { success: false, error: raw };
    }

    const ccl = cclStr ? parseFloat(cclStr.replace(",", ".")) : null;
    const validCcl = ccl && ccl > 0 ? ccl : null;

    const hasUsdPositions = raw.some((p) => p.currency === "USD");
    if (hasUsdPositions && !validCcl) {
      return {
        success: false,
        error:
          "El archivo contiene posiciones en USD pero no se proporcionó el CCL. Es obligatorio para calcular el valor total en ARS.",
      };
    }

    const { positions, totalValueArs } = computeTotalsAndAllocations(raw, validCcl);
    const totalValueUsd = validCcl ? totalValueArs / validCcl : null;

    if (await snapshotExists(userId, snapshotDate)) {
      return { success: false, error: duplicateDateError(dateStr) };
    }

    const snapshot = await db.portfolioSnapshot.create({
      data: {
        snapshotDate,
        totalValueArs,
        totalValueUsd,
        ccl: validCcl,
        sourceFile: file.name,
        userId,
        positions: {
          create: positions.map((p) => ({
            ticker: p.ticker,
            instrumentName: p.instrumentName || null,
            quantity: p.quantity,
            price: p.price,
            currency: p.currency,
            positionValue: p.positionValue,
            allocationPct: p.allocationPct,
          })),
        },
      },
    });

    revalidatePortfolioData(userId);

    // Siempre, aunque el snapshot valga $0: el primero crea los hitos por defecto.
    const isFirstSnapshot = (await db.portfolioSnapshot.count({ where: { userId } })) === 1;
    await checkAndUpdateMilestones(snapshot.id, { isFirstSnapshot });

    const setup = await getSetupStatus();
    const pending = setup.steps.find(
      (s) => s.actionable && !s.done && s.id !== "snapshot"
    );

    return {
      success: true,
      snapshotId: snapshot.id,
      positionCount: positions.length,
      totalValueArs,
      nextStep: pending
        ? { label: pending.label, href: pending.href, ctaLabel: pending.ctaLabel }
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}

export async function deleteSnapshot(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await requireUserId();
    const result = await db.portfolioSnapshot.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return { success: false, error: "No se encontró el snapshot." };
    }
    revalidatePortfolioData(userId);
    return { success: true };
  } catch {
    return { success: false, error: "No se pudo eliminar el snapshot." };
  }
}
