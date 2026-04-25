/**
 * Script de migración: crea el usuario admin y asocia todos los datos
 * existentes en la DB a ese usuario.
 *
 * Ejecución: node scripts/seed-admin.mjs
 */

import { readFileSync } from "fs";
import { Client } from "pg";
import { randomBytes, scrypt, randomUUID } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
const envContent = readFileSync(".env", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  process.env[key] = value;
}

const ADMIN_EMAIL = "admin@portfolio.com";
const ADMIN_NAME = "Admin";
const ADMIN_PASSWORD = "Admin1234!";

// ---------------------------------------------------------------------------
// Hash password — same format as @better-auth/utils/password:
// scrypt(N=16384, r=16, p=1, dkLen=64) → `${saltHex}:${keyHex}`
// ---------------------------------------------------------------------------
async function hashPassword(password) {
  const saltHex = randomBytes(16).toString("hex");
  const key = await scryptAsync(
    Buffer.from(password.normalize("NFKC")),
    saltHex,
    64,
    { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }
  );
  return `${saltHex}:${key.toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("Conectado a la DB\n");

try {
  // 1. Check if admin user already exists
  const existing = await client.query(
    `SELECT id FROM "user" WHERE email = $1`,
    [ADMIN_EMAIL]
  );

  let adminId;

  if (existing.rows.length > 0) {
    adminId = existing.rows[0].id;
    console.log(`Usuario admin ya existe con id: ${adminId}`);
  } else {
    // 2. Create admin user
    adminId = randomUUID();
    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, ADMIN_NAME, ADMIN_EMAIL, true, now, now]
    );

    // 3. Create account (credential/email+password provider)
    const accountId = randomUUID();
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    await client.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [accountId, adminId, "credential", adminId, passwordHash, now, now]
    );

    console.log(`Usuario admin creado con id: ${adminId}`);
    console.log(`  Email:      ${ADMIN_EMAIL}`);
    console.log(`  Contraseña: ${ADMIN_PASSWORD}`);
  }

  // 4. Associate existing data to admin user
  const tables = [
    "portfolio_snapshots",
    "transactions",
    "dividends",
    "retirement_settings",
    "target_allocations",
    "milestone_alerts",
  ];

  console.log("\nAsociando datos existentes al usuario admin...");

  for (const table of tables) {
    const result = await client.query(
      `UPDATE ${table} SET "userId" = $1 WHERE "userId" IS NULL`,
      [adminId]
    );
    console.log(`  ${table}: ${result.rowCount} registros actualizados`);
  }

  console.log("\n✓ Migración completada exitosamente.");
  console.log(`\nPodés ingresar a la app con:`);
  console.log(`  Email:      ${ADMIN_EMAIL}`);
  console.log(`  Contraseña: ${ADMIN_PASSWORD}`);
} catch (err) {
  console.error("\nError durante la migración:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
