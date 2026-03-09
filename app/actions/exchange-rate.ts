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
