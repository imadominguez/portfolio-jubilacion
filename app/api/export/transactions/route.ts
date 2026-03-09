import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const transactions = await db.transaction.findMany({
    orderBy: { date: "desc" },
  });

  const header = "Fecha,Tipo,Ticker,Cantidad,Precio,Moneda,Comisión,Notas";
  const rows = transactions.map((tx) =>
    [
      new Date(tx.date).toISOString().split("T")[0],
      tx.type,
      tx.ticker,
      Number(tx.quantity),
      Number(tx.price),
      tx.currency,
      tx.fee ? Number(tx.fee) : "",
      `"${(tx.notes ?? "").replace(/"/g, '""')}"`,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transacciones-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
