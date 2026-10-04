import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ESTRATEGIA_DEFAULT, ESTRATEGIA_TITLE } from "../lib/default-strategy";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const db = new PrismaClient({ adapter });

/**
 * Empuja la estrategia compacta (`lib/default-strategy.ts`) a la base como una
 * nueva versión activa. Idempotente: si la activa ya coincide, no hace nada.
 *
 * Uso: npm run db:strategy
 */
async function main() {
  const content = ESTRATEGIA_DEFAULT.trim();

  const active = await db.investmentStrategy.findFirst({
    where: { isActive: true },
    select: { id: true, content: true, version: true },
  });

  if (active?.content === content) {
    console.log(
      `La estrategia activa (v${active.version}) ya coincide con la versión compacta. Nada que hacer.`
    );
    return;
  }

  const last = await db.investmentStrategy.findFirst({
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (last?.version ?? 0) + 1;

  await db.$transaction(async (tx) => {
    await tx.investmentStrategy.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await tx.investmentStrategy.create({
      data: {
        title: `${ESTRATEGIA_TITLE} v${nextVersion}`,
        content,
        isActive: true,
        version: nextVersion,
      },
    });
  });

  const prev = active ? `v${active.version}` : "ninguna";
  console.log(
    `Estrategia compacta insertada como v${nextVersion} y activada (antes: ${prev}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
