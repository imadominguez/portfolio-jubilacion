import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { runAllAlerts } from "@/lib/alerts-runner";
import { refreshMarketData } from "@/lib/market-refresh";
import { runMonthlyTasks } from "@/lib/monthly-runner";

// Datos de mercado, alertas por acción (~16 por usuario contra Yahoo) y, una vez
// por mes, el reporte de oportunidades (hasta 150 s) y el resumen.
export const maxDuration = 300;

// Lo llama el cron de Vercel (vercel.json) con `Authorization: Bearer
// <CRON_SECRET>`. El proxy no le pide sesión: la autorización es este secreto.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(req.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    // Primero los datos de mercado (ADR-0021): las pantallas y las alertas de
    // hoy usan precios del día. updateTag solo funciona en Server Actions.
    const market = await refreshMarketData();
    for (const tag of market.tags) revalidateTag(tag, "max");

    const results = await runAllAlerts();
    // Reporte de oportunidades del mes y resumen mensual: después de las alertas,
    // con los datos de mercado del día.
    const monthly = await runMonthlyTasks();
    // Solo conteos y estado de los datos globales: nada de mails ni datos de usuarios.
    return NextResponse.json({
      market: market.steps,
      users: results.length,
      failed: results.filter((r) => !r.ok).length,
      mailsSent: results.filter((r) => r.sent).length,
      drops: results.reduce((acc, r) => acc + r.drops, 0),
      reminders: results.filter((r) => r.reminder).length,
      monthly,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo completar la corrida diaria" }, { status: 500 });
  }
}
