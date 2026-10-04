import "dotenv/config";
import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { UserRole } from "../app/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import { ESTRATEGIA_DEFAULT, ESTRATEGIA_TITLE } from "../lib/default-strategy";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const db = new PrismaClient({ adapter });

async function seedInvestmentStrategy(): Promise<void> {
  const existing = await db.investmentStrategy.count();

  if (existing > 0) {
    console.log(`Seed estrategia omitido: ya existe ${existing} registro(s).`);
    return;
  }

  await db.investmentStrategy.create({
    data: {
      title: ESTRATEGIA_TITLE,
      content: ESTRATEGIA_DEFAULT.trim(),
      isActive: true,
      version: 1,
    },
  });

  console.log("Seed completado: estrategia v1 insertada como activa.");
}

/**
 * Opcional: `SEED_ADMIN_EMAIL` con uno o más emails separados por coma.
 * Actualiza usuarios ya existentes; no crea cuentas Better Auth.
 */
async function seedAdminRoles(): Promise<void> {
  const raw = process.env.SEED_ADMIN_EMAIL?.trim();
  if (!raw) {
    return;
  }

  const emails = raw.split(",").map((e) => e.trim()).filter(Boolean);
  for (const email of emails) {
    const result = await db.user.updateMany({
      where: { email },
      data: { role: UserRole.ADMIN },
    });
    if (result.count === 0) {
      console.warn(`Seed admin omitido: no hay usuario con email "${email}".`);
    } else {
      console.log(`Seed admin: rol ADMIN asignado a "${email}".`);
    }
  }
}

async function main() {
  await seedInvestmentStrategy();
  await seedAdminRoles();
}

main().catch((e: unknown) => {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
    console.error(
      "\n[seed] La base apuntada por DATABASE_URL no tiene las tablas Prisma esperadas.",
      "\n      Aplicá migraciones primero (mismo entorno que usa este DATABASE_URL):\n",
      "        pnpm prisma migrate deploy\n",
      "      En desarrollo local también podés usar: pnpm prisma migrate dev\n"
    );
  } else {
    console.error(e);
  }
  process.exit(1);
}).finally(() => db.$disconnect());
