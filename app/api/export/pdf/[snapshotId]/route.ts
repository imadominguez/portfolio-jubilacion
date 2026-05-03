import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { createElement } from "react";
import type { ReactElement } from "react";
import { db } from "@/lib/db";
import { PortfolioPDF } from "@/components/export/portfolio-pdf";
import type { PDFPosition, PDFSector } from "@/components/export/portfolio-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const { snapshotId } = await params;

  const snapshot = await db.portfolioSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      positions: { orderBy: { positionValue: "desc" } },
    },
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot no encontrado" }, { status: 404 });
  }

  // Build positions
  const positions: PDFPosition[] = snapshot.positions.map((p) => ({
    ticker: p.ticker,
    instrumentName: p.instrumentName,
    quantity: Number(p.quantity),
    price: Number(p.price),
    positionValue: Number(p.positionValue),
    allocationPct: Number(p.allocationPct) * 100,
  }));

  // Build sector concentration from asset metadata
  const assets = await db.asset.findMany({
    select: { ticker: true, sector: true },
  });
  const assetMap = new Map(assets.map((a) => [a.ticker, a]));
  const total = Number(snapshot.totalValueArs);

  const sectorMap = new Map<string, number>();
  for (const pos of snapshot.positions) {
    const asset = assetMap.get(pos.ticker);
    const sector = asset?.sector ?? "Sin clasificar";
    const val = Number(pos.positionValue);
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + val);
  }

  const sectors: PDFSector[] = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Format values for display
  const formatARS = (v: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(v);

  const formatUSD = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(v);

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(d));

  const snapshotDate = formatDate(snapshot.snapshotDate);
  const totalUsd = snapshot.totalValueUsd
    ? formatUSD(Number(snapshot.totalValueUsd))
    : null;
  const ccl = snapshot.ccl
    ? `$ ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(Number(snapshot.ccl))}`
    : null;
  const generatedAt = new Date().toLocaleDateString("es-AR");

  const pdfElement = createElement(PortfolioPDF, {
    snapshotDate,
    totalArs: formatARS(total),
    totalUsd,
    ccl,
    positions,
    sectors,
    generatedAt,
  });

  const buffer = await renderToBuffer(pdfElement as ReactElement<DocumentProps>);

  const dateStr = new Date(snapshot.snapshotDate).toISOString().split("T")[0];

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="portfolio-${dateStr}.pdf"`,
    },
  });
}
