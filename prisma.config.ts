import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm exec tsx prisma/seed.ts",
  },
  datasource: {
    // La CLI (migrate, db execute, studio) va por la conexión directa: la app usa
    // la pooled (PgBouncer en modo transacción), que no sirve para migraciones.
    // Sin DIRECT_URL se usa DATABASE_URL, como antes.
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
