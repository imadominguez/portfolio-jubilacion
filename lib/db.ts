import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Pool propio en lugar del que arma PrismaPg con los valores de pg (10 conexiones,
// 10 s ociosas). En Vercel cada instancia tiene su pool y, congelada entre pedidos,
// el temporizador que cierra las ociosas no corre: las conexiones quedaban abiertas
// minutos y llenaban el tope de la base ("Failed to connect to upstream database").
// attachDatabasePool mantiene viva la instancia hasta que el pool suelta las
// ociosas; fuera de Vercel no hace nada.
function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
    // Una página hace hasta ~6 lecturas en paralelo: con 5 casi no espera y diez
    // instancias no alcanzan el tope.
    max: 5,
    idleTimeoutMillis: 5_000,
  });
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
