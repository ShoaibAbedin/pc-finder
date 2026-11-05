/**
 * GitHub Actions gate: decides whether this scheduled wake-up should run a full update.
 * Writes `run=true|false` to $GITHUB_OUTPUT (and prints the reason).
 *   FORCE=true  → always run (manual refresh / workflow_dispatch)
 *   UPDATE_INTERVAL_HOURS → interval (default 10)
 */
import { appendFileSync } from "node:fs";
import { createServiceClient, loadEnv } from "../lib/db/client";
import { parseIntervalHours, shouldRunUpdate } from "../lib/schedule";

loadEnv();
const db = createServiceClient();
const { data, error } = await db
  .from("scrape_runs")
  .select("started_at")
  .in("status", ["ok", "partial"])
  .order("started_at", { ascending: false })
  .limit(1);
if (error) throw new Error(`scrape_runs: ${error.message}`);

const decision = shouldRunUpdate({
  lastSuccessStart: data?.[0] ? new Date(data[0].started_at) : null,
  intervalHours: parseIntervalHours(process.env.UPDATE_INTERVAL_HOURS),
  now: new Date(),
  force: process.env.FORCE === "true",
});
console.log(`${decision.run ? "RUN" : "SKIP"}: ${decision.reason}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${decision.run}\n`);
