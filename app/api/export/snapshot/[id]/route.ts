import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format");

  const snapshot = await db.portfolioSnapshot.findUnique({
    where: { id },
    include: {
      positions: { orderBy: { positionValue: "desc" } },
    },
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot no encontrado" }, { status: 404 });
  }

  if (format === "csv") {
    const header = "Ticker,Instrumento,Cantidad,Precio ARS,Valor ARS,Asignación %";
    const csvRows = snapshot.positions.map((p) =>
      [
        p.ticker,
        `"${(p.instrumentName ?? "").replace(/"/g, '""')}"`,
        Number(p.quantity),
        Number(p.price),
        Number(p.positionValue),
        (Number(p.allocationPct) * 100).toFixed(4),
      ].join(",")
    );
    const csv = [header, ...csvRows].join("\n");
    const dateStr = new Date(snapshot.snapshotDate).toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="portfolio-${dateStr}.csv"`,
      },
    });
  }

  const formatARS = (v: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(v);

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(d));

  const rows = snapshot.positions
    .map(
      (p) => `
    <tr>
      <td style="padding:8px 12px;font-family:monospace;font-weight:600">${p.ticker}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace">${Number(p.quantity).toLocaleString("es-AR")}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace">${formatARS(Number(p.price))}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace">${formatARS(Number(p.positionValue))}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace">${(Number(p.allocationPct) * 100).toFixed(2)}%</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Portfolio — ${formatDate(snapshot.snapshotDate)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; color: #111; background: #fff; padding: 40px; font-size: 13px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 32px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
  .kpi-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .kpi-value { font-size: 18px; font-weight: 700; font-family: monospace; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f9fafb; }
  th { padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; font-weight: 600; }
  th:not(:first-child) { text-align: right; }
  tr:not(:last-child) td { border-bottom: 1px solid #f0f0f0; }
  .footer { margin-top: 32px; color: #aaa; font-size: 11px; }
  @media print {
    body { padding: 20px; }
    .kpi-grid { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<h1>Portfolio de Jubilación</h1>
<p class="subtitle">Snapshot del ${formatDate(snapshot.snapshotDate)} · Cocos Capital</p>

<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">Valor total ARS</div>
    <div class="kpi-value">${formatARS(Number(snapshot.totalValueArs))}</div>
  </div>
  ${
    snapshot.totalValueUsd
      ? `<div class="kpi">
    <div class="kpi-label">Equivalente USD</div>
    <div class="kpi-value">USD ${Number(snapshot.totalValueUsd).toLocaleString("en-US", { minimumFractionDigits: 0 })}</div>
  </div>`
      : ""
  }
  ${
    snapshot.ccl
      ? `<div class="kpi">
    <div class="kpi-label">Tipo de cambio CCL</div>
    <div class="kpi-value">$ ${Number(snapshot.ccl).toLocaleString("es-AR", { minimumFractionDigits: 0 })}</div>
  </div>`
      : ""
  }
  <div class="kpi">
    <div class="kpi-label">Posiciones</div>
    <div class="kpi-value">${snapshot.positions.length}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Ticker</th>
      <th style="text-align:right">Cantidad</th>
      <th style="text-align:right">Precio</th>
      <th style="text-align:right">Valor</th>
      <th style="text-align:right">Asign. %</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

<div class="footer">
  Generado el ${new Date().toLocaleDateString("es-AR")} · Portfolio Jubilación
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
