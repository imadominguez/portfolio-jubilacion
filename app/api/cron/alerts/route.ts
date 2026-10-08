import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runAllAlerts } from "@/lib/alerts-runner";

// Revisa ~16 acciones por usuario contra Yahoo y manda mails.
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
    const results = await runAllAlerts();
    // Solo conteos: nada de mails ni datos de usuarios en la respuesta.
    return NextResponse.json({
      users: results.length,
      failed: results.filter((r) => !r.ok).length,
      mailsSent: results.filter((r) => r.sent).length,
      drops: results.reduce((acc, r) => acc + r.drops, 0),
      reminders: results.filter((r) => r.reminder).length,
    });
  } catch {
    return NextResponse.json({ error: "No se pudieron correr las alertas" }, { status: 500 });
  }
}
