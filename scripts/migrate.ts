/**
 * Applies supabase/migrations/*.sql in order, once each (tracked in the _migrations table).
 *   npm run db:migrate
 * Needs DATABASE_URL (Supabase "Session pooler" connection string) in .env.local.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { loadEnv, requireEnv } from "../lib/db/client";

loadEnv();
const dir = join(process.cwd(), "supabase", "migrations");
const sql = postgres(requireEnv("DATABASE_URL"), { ssl: "require", max: 1, onnotice: () => {} });

try {
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
  await sql`alter table _migrations enable row level security`;
  const applied = new Set((await sql<{ name: string }[]>`select name from _migrations`).map((r) => r.name));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const f of files) {
    if (applied.has(f)) {
      console.log(`  skip   ${f}`);
      continue;
    }
    const text = readFileSync(join(dir, f), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into _migrations (name) values (${f})`;
    });
    console.log(`  apply  ${f}`);
  }
  console.log("Migrations up to date.");
} finally {
  await sql.end();
}
