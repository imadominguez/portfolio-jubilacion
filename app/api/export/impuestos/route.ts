import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-session";
import { buildTaxReport, getTaxData } from "@/lib/tax-report-data";
import { taxReportCsv } from "@/lib/tax-report";

export async function GET(req: NextRequest) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const year = Number(req.nextUrl.searchParams.get("anio"));
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Año inválido" }, { status: 400 });
  }

  try {
    // getTaxData filtra por el usuario de la sesión.
    const csv = taxReportCsv(buildTaxReport(await getTaxData(), year));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="impuestos-${year}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el reporte" }, { status: 500 });
  }
}
