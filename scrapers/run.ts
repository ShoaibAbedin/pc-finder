/**
 * Runs all enabled scrapers and saves results.
 *
 *   npm run scrape                         # all sources → Supabase
 *   npm run scrape -- --dry-run            # scrape & print, no database writes
 *   npm run scrape -- --only=mwave         # just one source (comma-separated list allowed)
 *   npm run scrape -- --max-pages=1        # cap listing pages per category (quick test)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, loadEnv } from "../lib/db/client";
import {
  expireMissingProducts,
  expireOzDeals,
  finishRun,
  saveListings,
  saveOzDeals,
  startRun,
} from "../lib/db/save";
import { scraperConfig } from "./config";
import { BlockedError, PoliteFetcher, RobotsDisallowedError } from "./core/fetcher";
import { createLogger } from "./core/logger";
import type { ScrapeOutput, ScraperModule } from "./core/types";
import { scrapers } from "./registry";
import { queriesFromTargets } from "./sources/staticice";
import { loadTargets } from "../lib/ai/targets";

interface Args {
  dryRun: boolean;
  only?: string[];
  maxPages?: number;
}

function parseArgs(argv: string[]): Args {
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  return {
    dryRun: argv.includes("--dry-run"),
    only: get("only")?.split(",").map((s) => s.trim()),
    maxPages: get("max-pages") ? parseInt(get("max-pages")!, 10) : undefined,
  };
}

const fmtPrice = (c: number | null) => (c === null ? "—" : `$${(c / 100).toFixed(2)}`);

function printDryRun(s: ScraperModule, out: ScrapeOutput) {
  const log = createLogger(s.id);
  if (out.deals) {
    log.info(`DRY RUN: ${out.deals.length} deals`);
    for (const d of out.deals.slice(0, 8))
      console.log(
        `   ${d.expired ? "[expired] " : ""}${fmtPrice(d.priceCents).padStart(10)}  ${d.category.padEnd(10)} ${d.retailerId ?? d.store ?? "?"}  ${d.title.slice(0, 80)}`,
      );
  }
  if (out.listings) {
    log.info(`DRY RUN: ${out.listings.length} listings`);
    const byCat = new Map<string, number>();
    for (const l of out.listings) byCat.set(l.category, (byCat.get(l.category) ?? 0) + 1);
    console.log("   per category:", Object.fromEntries(byCat));
    console.log("   complete:", out.completedCategories?.join(", ") || "none");
    if (out.incompleteCategories?.length) console.log("   incomplete:", out.incompleteCategories.join(", "));
    for (const l of out.listings.slice(0, 5))
      console.log(`   ${fmtPrice(l.priceCents).padStart(10)}  ${l.inStock ? "in stock " : "no stock "} ${l.title.slice(0, 80)}`);
  }
}

async function runOne(
  s: ScraperModule,
  args: Args,
  db: SupabaseClient | null,
  searchQueries: ReturnType<typeof queriesFromTargets>,
): Promise<string> {
  const log = createLogger(s.id);
  const fetcher = new PoliteFetcher({ log });
  const startedAt = new Date().toISOString();
  const runId = db ? await startRun(db, s.id, startedAt) : null;
  log.info("starting");

  try {
    const out = await s.scrape({ fetch: fetcher, log, maxPages: args.maxPages, searchQueries });

    if (!db || runId === null) {
      printDryRun(s, out);
      return `${s.id}: ok (dry run, ${fetcher.requestCount} requests)`;
    }

    let found = 0,
      created = 0,
      changed = 0,
      expired = 0;

    if (out.deals) {
      const r = await saveOzDeals(db, out.deals, startedAt);
      found += r.found;
      created += r.new;
      expired += await expireOzDeals(db, scraperConfig.ozbargainStaleDays);
    }
    if (out.listings) {
      const r = await saveListings(db, s.id, out.listings, startedAt);
      found += r.found;
      created += r.new;
      changed += r.changed;
      // Only categories that were scraped completely can expire missing products.
      expired += await expireMissingProducts(
        db,
        s.id,
        out.completedCategories ?? [],
        startedAt,
        scraperConfig.expireAfterMissedRuns,
      );
    }

    const partial = (out.incompleteCategories?.length ?? 0) > 0;
    await finishRun(db, runId, {
      status: partial ? "partial" : "ok",
      items_found: found,
      items_new: created,
      items_changed: changed,
      items_expired: expired,
      requests: fetcher.requestCount,
      message: partial ? `incomplete: ${out.incompleteCategories!.join(", ")}` : null,
    });
    const summary = `${s.id}: ${partial ? "partial" : "ok"} — ${found} found, ${created} new, ${changed} changed, ${expired} expired, ${fetcher.requestCount} requests`;
    log.info(summary);
    return summary;
  } catch (err) {
    const blocked = err instanceof BlockedError || err instanceof RobotsDisallowedError;
    const msg = (err as Error).message;
    if (blocked) log.warn(`SKIPPED (blocked): ${msg}`);
    else log.error(msg);
    if (db && runId !== null) {
      await finishRun(db, runId, {
        status: blocked ? "blocked" : "error",
        requests: fetcher.requestCount,
        message: msg.slice(0, 1000),
      }).catch((e) => log.error(`could not record run: ${(e as Error).message}`));
    }
    return `${s.id}: ${blocked ? "BLOCKED" : "ERROR"} — ${msg}`;
  }
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const selected = scrapers.filter((s) => !args.only || args.only.includes(s.id));
  if (!selected.length) throw new Error(`No scrapers match --only=${args.only?.join(",")}`);

  const db = args.dryRun ? null : createServiceClient();
  const t0 = Date.now();

  // Search terms for StaticICE come from the AI build targets (recommended models), if any.
  const targets = db ? await loadTargets(db).catch(() => null) : null;
  const searchQueries = queriesFromTargets(targets?.data ?? null);

  // Different sites run in parallel; requests to the same site are still serialised + delayed.
  const results = await Promise.all(selected.map((s) => runOne(s, args, db, searchQueries)));

  console.log(`\n=== Done in ${((Date.now() - t0) / 1000).toFixed(0)}s ===`);
  for (const r of results) console.log(" -", r);
  // A blocked source is expected/okay; only real errors fail the process (so GitHub Actions flags them).
  if (results.some((r) => r.includes(": ERROR"))) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
