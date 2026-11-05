/** Prints a quick summary of what's in the database.  npm run db:check */
import { createServiceClient, loadEnv } from "../lib/db/client";

loadEnv();
const db = createServiceClient();

const count = async (table: string, filter?: (q: any) => any) => {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
};

console.log("retailers:       ", await count("retailers"));
console.log("products:        ", await count("products"));
for (const s of ["active", "out_of_stock", "expired"])
  console.log(`   ${s.padEnd(14)}`, await count("products", (q) => q.eq("status", s)));
console.log("price_history:   ", await count("price_history"));
console.log("ozbargain_deals: ", await count("ozbargain_deals"));
console.log("   active        ", await count("ozbargain_deals", (q) => q.eq("status", "active")));

const { data: runs } = await db
  .from("scrape_runs")
  .select("source_id, started_at, status, items_found, items_new, items_changed, items_expired, requests, message")
  .order("started_at", { ascending: false })
  .limit(6);
console.log("\nrecent runs:");
console.table(runs);
