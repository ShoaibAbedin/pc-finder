/**
 * AI + ranking pass (runs after scraping):
 *   npm run process                       # parse new/changed titles, then rank
 *   npm run process -- --max-batches=5    # limit AI spec-parsing batches this run
 *   npm run process -- --rank-only        # skip spec parsing
 */
import { providersFromEnv } from "../lib/ai/client";
import { runSpecParsing } from "../lib/ai/specs";
import { createServiceClient, loadEnv } from "../lib/db/client";
import { runRanking } from "../lib/ranking/run";

loadEnv();
const argv = process.argv.slice(2);
const arg = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

const db = createServiceClient();
const deps = { providers: providersFromEnv(), db, log };
if (!deps.providers.length) log("WARNING: no GEMINI_API_KEY / GROQ_API_KEY — AI steps will fall back to templates");

if (!argv.includes("--rank-only") && deps.providers.length) {
  const maxBatches = Number(arg("max-batches") ?? process.env.AI_MAX_BATCHES_PER_RUN ?? 60);
  const minutes = Number(arg("minutes") ?? process.env.AI_MINUTES_PER_RUN ?? 25);
  const r = await runSpecParsing(db, deps, { maxBatches, log, timeBudgetMs: minutes * 60_000 });
  log(`spec parsing done: ${r.parsed} parsed, ${r.pending} still pending, ${r.failedBatches} failed batches${r.stoppedEarly ? " (stopped: AI limits)" : ""}`);
}

const summary = await runRanking(db, deps, log);
log(`ranking done: ${JSON.stringify(summary)}`);
