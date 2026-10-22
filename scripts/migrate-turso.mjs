import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";

const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).map((line) => {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))\s*$/);
  return match ? [match[1], match[2] ?? match[3] ?? match[4] ?? ""] : null;
}).filter(Boolean));
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) throw new Error("Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env.local.");

const sql = await readFile(new URL("../drizzle/0004_turso_schema.sql", import.meta.url), "utf8");
const statements = sql.split(/--> statement-breakpoint\s*/).map((part) => part.trim()).filter(Boolean);
const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
try {
  await db.batch(statements.map((statement) => ({ sql: statement, args: [] })), "write");
  const rows = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('events','coupons','reservations','payments','audit_logs') ORDER BY name");
  if (rows.rows.length !== 5) throw new Error("La migración terminó, pero no aparecen todas las tablas esperadas.");
  process.stdout.write("Migración de Turso aplicada; tablas verificadas: " + rows.rows.map((row) => row.name).join(", ") + "\n");
} finally {
  db.close();
}
