// Backfill: crea un Movement por cada Transaction legacy importada antes del
// refactor (identificadas por notes = "Cocos #<nroTicket>") y las vincula.
//
// Uso: pnpm exec tsx scripts/backfill-movements.ts
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const db = new PrismaClient({ adapter });

async function main() {
  const legacy = await db.transaction.findMany({
    where: { notes: { startsWith: "Cocos #" } },
    orderBy: { date: "asc" },
  });

  if (legacy.length === 0) {
    console.log("No hay transacciones legacy para backfillear.");
    return;
  }

  let created = 0;
  let linked = 0;

  for (const tx of legacy) {
    const nroTicket = tx.notes!.replace(/^Cocos #/, "");
    let movement = await db.movement.findFirst({
      where: { userId: tx.userId, nroTicket },
    });

    if (!movement) {
      movement = await db.movement.create({
        data: {
          nroTicket,
          date: tx.date,
          rawType: "(legacy)",
          category: tx.type === "BUY" ? "TRADE_BUY" : "TRADE_SELL",
          instrument: null,
          ticker: tx.ticker,
          currency: tx.currency,
          quantity: tx.quantity,
          price: tx.price,
          total: Number(tx.quantity) * Number(tx.price) + (tx.fee ? Number(tx.fee) : 0),
          sourceFile: null,
          userId: tx.userId,
        },
      });
      created++;
    }

    if (!tx.movementId) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { movementId: movement.id },
      });
      linked++;
    }
  }

  console.log(`Backfill completo: ${legacy.length} transacciones legacy, ${created} movimientos creados, ${linked} vinculados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
