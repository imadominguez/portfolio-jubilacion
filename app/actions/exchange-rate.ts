"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ExchangeRateResult =
  | { success: true; ccl: number; date: string; alreadyExisted: boolean }
  | { success: false; error: string };

type DolarApiResponse = {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
};

export async function fetchAndSaveCCL(): Promise<ExchangeRateResult> {
  try {
    const res = await fetch(
      "https://dolarapi.com/v1/dolares/contadoconliqui",
      { cache: "no-store" }
    );

    if (!res.ok) {
      return { success: false, error: `Error al obtener el CCL (HTTP ${res.status}).` };
    }

    const data: DolarApiResponse = await res.json();
    const ccl = data.venta ?? data.compra;

    if (!ccl || ccl <= 0) {
      return { success: false, error: "La API devolvió un valor de CCL inválido." };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db.exchangeRate.findUnique({
      where: { date: today },
    });

    if (existing) {
      await db.exchangeRate.update({
        where: { date: today },
        data: { ccl, source: "dolarapi.com" },
      });
    } else {
      await db.exchangeRate.create({
        data: { date: today, ccl, source: "dolarapi.com" },
      });
    }

    revalidatePath("/");
    revalidatePath("/snapshots");

    return {
      success: true,
      ccl,
      date: today.toISOString().split("T")[0],
      alreadyExisted: !!existing,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al obtener el CCL.";
    return { success: false, error: message };
  }
}

export async function getLatestExchangeRate(): Promise<{
  ccl: number;
  date: Date;
  source: string | null;
} | null> {
  const rate = await db.exchangeRate.findFirst({
    orderBy: { date: "desc" },
  });

  if (!rate) return null;
  return { ccl: Number(rate.ccl), date: rate.date, source: rate.source };
}

export async function getAllExchangeRates(): Promise<
  { date: Date; ccl: number; source: string | null }[]
> {
  const rates = await db.exchangeRate.findMany({
    orderBy: { date: "asc" },
  });
  return rates.map((r) => ({ date: r.date, ccl: Number(r.ccl), source: r.source }));
}

// ---------------------------------------------------------------------------
// fetchHistoricalCCL
//
// Obtiene el historial del dólar CCL desde dolarapi.com y lo persiste en la
// tabla ExchangeRate. Solo guarda fechas que no existan previamente.
// ---------------------------------------------------------------------------

type ArgentinaDatosItem = {
  moneda?: string;
  casa?: string;
  fecha: string;
  compra: number | null;
  venta: number | null;
};

export type HistoricalCCLResult =
  | { success: true; saved: number; skipped: number }
  | { success: false; error: string };

export async function fetchHistoricalCCL(
  from: Date,
  to: Date = new Date()
): Promise<HistoricalCCLResult> {
  try {
    const res = await fetch(
      "https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui",
      { cache: "no-store" }
    );

    if (!res.ok) {
      return {
        success: false,
        error: `argentinadatos.com respondió con HTTP ${res.status}.`,
      };
    }

    const raw: ArgentinaDatosItem[] = await res.json();

    if (!Array.isArray(raw) || raw.length === 0) {
      return { success: false, error: "La API no devolvió datos históricos." };
    }

    // Filtrar el rango solicitado
    const fromTs = from.getTime();
    const toTs = to.getTime();

    const filtered = raw.filter((item) => {
      const d = new Date(item.fecha);
      return !isNaN(d.getTime()) && d.getTime() >= fromTs && d.getTime() <= toTs;
    });

    // Obtener fechas ya persistidas para evitar duplicados innecesarios
    const existingRates = await db.exchangeRate.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      select: { date: true },
    });
    const existingDates = new Set(
      existingRates.map((r) => r.date.toISOString().split("T")[0])
    );

    let saved = 0;
    let skipped = 0;

    for (const item of filtered) {
      const ccl = item.venta ?? item.compra;
      if (!ccl || ccl <= 0) continue;

      const date = new Date(item.fecha);
      date.setUTCHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split("T")[0];

      if (existingDates.has(dateKey)) {
        skipped++;
        continue;
      }

      await db.exchangeRate.upsert({
        where: { date },
        create: { date, ccl, source: "argentinadatos.com" },
        update: { ccl, source: "argentinadatos.com" },
      });
      saved++;
    }

    revalidatePath("/real-gains");
    revalidatePath("/settings");

    return { success: true, saved, skipped };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al obtener el CCL histórico.";
    return { success: false, error: message };
  }
}
