import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";
import { generateOpportunityReport } from "@/lib/opportunity-runner";

// Reporte de oportunidades (ADR-0018). La generación vive en
// lib/opportunity-runner.ts, compartida con el cron mensual; este route solo
// resuelve la sesión y el rol. Corre en el runtime de Node.js (el default;
// Cache Components no admite el export `runtime`).
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  // Mismo criterio que la página /portfolio: cada análisis tiene costo en la API.
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "No autorizado. Se requiere rol administrador." }, { status: 403 });
  }

  const result = await generateOpportunityReport(session.user.id, { signal: request.signal });
  return result.ok
    ? NextResponse.json(result.report)
    : NextResponse.json({ error: result.error }, { status: result.status });
}
