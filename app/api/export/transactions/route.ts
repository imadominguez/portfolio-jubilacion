import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-session";
import { tradeGrossAmount } from "@/lib/trade-amount";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let transactions;
  try {
    transactions = await db.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { movement: { select: { grossAmount: true } } },
    });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer las transacciones" }, { status: 500 });
  }

  const header = "Fecha,Tipo,Ticker,Cantidad,Precio,Monto,Moneda,Comisión,Notas";
  const rows = transactions.map((tx) =>
    [
      new Date(tx.date).toISOString().split("T")[0],
      tx.type,
      tx.ticker,
      Math.abs(Number(tx.quantity)),
      Number(tx.price),
      // En bonos el precio es cada 100 nominales: el monto sale del bruto de Cocos.
      tradeGrossAmount({
        quantity: Number(tx.quantity),
        price: Number(tx.price),
        movementGross: tx.movement?.grossAmount != null ? Number(tx.movement.grossAmount) : null,
      }),
      tx.currency,
      tx.fee ? Number(tx.fee) : "",
      `"${(tx.notes ?? "").replace(/"/g, '""')}"`,
    ].join(",")
  );

  // BOM: sin él, Excel abre el archivo como ANSI y rompe los acentos.
  const csv = "\uFEFF" + [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transacciones-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
