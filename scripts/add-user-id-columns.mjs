import { readFileSync } from "fs";
import { Client } from "pg";

// Load env from .env file manually
const envContent = readFileSync(".env", "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) {
    const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
    process.env[key.trim()] = value;
  }
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("Conectado a la DB");

const sqls = [
  `ALTER TABLE portfolio_snapshots ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "user"(id)`,
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "user"(id)`,
  `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "user"(id)`,
  `ALTER TABLE retirement_settings ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "user"(id)`,
  `ALTER TABLE target_allocations ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "user"(id)`,
  `ALTER TABLE milestone_alerts ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "user"(id)`,
];

for (const sql of sqls) {
  console.log("Ejecutando:", sql.slice(0, 60) + "...");
  await client.query(sql);
  console.log("OK");
}

await client.end();
console.log("Columnas userId agregadas exitosamente.");
