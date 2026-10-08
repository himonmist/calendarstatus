// Applies migrations/*.sql in order, once each. Usage: DATABASE_URL=... npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true } });
await client.connect();
await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
for (const f of readdirSync("migrations").filter(f => f.endsWith(".sql")).sort()) {
  const done = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [f]);
  if (done.rowCount) continue;
  await client.query("BEGIN");
  try {
    await client.query(readFileSync(`migrations/${f}`, "utf8"));
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
    await client.query("COMMIT"); console.log("applied", f);
  } catch (e) { await client.query("ROLLBACK"); console.error("failed", f, e.message); process.exit(1); }
}
await client.end();
