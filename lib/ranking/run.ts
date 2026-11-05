import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiDeps } from "../ai/client";
import { loadSpecs } from "../ai/specs";
import { ensureTargets, loadTargets, type Targets } from "../ai/targets";
import { writeReasons } from "../ai/reasons";
import { settingsHash, type Settings } from "../settings/schema";
import { loadSettings } from "../settings/store";
import { rankingConfig } from "./config";
import { buildPartIndex, partsTotalFor } from "./prebuilt";
import { categoryBudgets, scoreCandidate, selectForYou, type Candidate, type Scored } from "./score";

const PAGE = 1000;

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadCandidates(db: SupabaseClient): Promise<Candidate[]> {
  const [listings, hashes, oz] = await Promise.all([
    pageAll<any>((a, b) =>
      db
        .from("deal_listings")
        .select(
          "id,retailer_id,retailer_name,melbourne_pickup,title,url,category,image_url,current_price_cents,in_stock,status,prev_price_cents,drop_cents,drop_pct,high_30d_cents,history_points,is_30d_low,price_dropped,is_new",
        )
        .neq("status", "expired")
        .order("id")
        .range(a, b),
    ),
    pageAll<{ id: number; title_hash: string }>((a, b) =>
      db.from("products").select("id,title_hash").neq("status", "expired").order("id").range(a, b),
    ),
    pageAll<any>((a, b) =>
      db
        .from("oz_deal_listings")
        .select("node_id,title,link,category,image_url,price_cents,retailer_id,retailer_name,melbourne_pickup,votes_pos,is_new,title_hash")
        .eq("status", "active")
        .neq("category", "other")
        .order("node_id")
        .range(a, b),
    ),
  ]);

  const hashById = new Map(hashes.map((h) => [h.id, h.title_hash]));
  const specs = await loadSpecs(db, [...hashes.map((h) => h.title_hash), ...oz.map((o) => o.title_hash)]);

  const products: Candidate[] = listings.map((l) => ({
    key: `p:${l.id}`,
    source: "product",
    category: l.category,
    title: l.title,
    url: l.url,
    imageUrl: l.image_url,
    retailerId: l.retailer_id,
    retailerName: l.retailer_name,
    melbournePickup: !!l.melbourne_pickup,
    priceCents: l.current_price_cents,
    status: l.status,
    inStock: l.in_stock,
    prevPriceCents: l.prev_price_cents,
    dropCents: l.drop_cents,
    dropPct: l.drop_pct,
    high30Cents: l.high_30d_cents,
    historyPoints: l.history_points ?? 0,
    is30dLow: !!l.is_30d_low,
    priceDropped: !!l.price_dropped,
    isNew: !!l.is_new,
    specs: specs.get(hashById.get(l.id) ?? ""),
  }));
  const ozDeals: Candidate[] = oz.map((o) => ({
    key: `oz:${o.node_id}`,
    source: "oz",
    category: o.category,
    title: o.title,
    url: o.link,
    imageUrl: o.image_url,
    retailerId: o.retailer_id,
    retailerName: o.retailer_name,
    melbournePickup: !!o.melbourne_pickup,
    priceCents: o.price_cents,
    status: "active",
    inStock: null,
    prevPriceCents: null,
    dropCents: null,
    dropPct: null,
    high30Cents: null,
    historyPoints: 0,
    is30dLow: false,
    priceDropped: false,
    isNew: !!o.is_new,
    votes: o.votes_pos,
    specs: specs.get(o.title_hash),
  }));
  return [...products, ...ozDeals];
}

export function rankAll(cands: Candidate[], s: Settings, t: Targets | null) {
  const idx = buildPartIndex(cands);
  for (const c of cands) if (c.category === "prebuilt") c.partsCents = partsTotalFor(c, idx).cents;
  const budgets = categoryBudgets(s, t);
  const scored = cands.map((c) => scoreCandidate(c, s, t, budgets)).filter((x): x is Scored => x !== null);
  return { scored, forYou: selectForYou(scored), budgets };
}

export interface RankingSummary {
  status: "ok" | "no-settings";
  runId?: number;
  scored?: number;
  forYou?: number;
  targetsSource?: "ai" | "cached" | "fallback";
}

/** Full ranking pass: targets → score everything → For You → reasons → snapshot. */
export async function runRanking(
  db: SupabaseClient,
  deps: AiDeps,
  log: (m: string) => void = () => {},
): Promise<RankingSummary> {
  const s = await loadSettings(db);
  if (!s) {
    log("ranking: no settings saved yet — skipping");
    return { status: "no-settings" };
  }

  let targets: Targets | null = null;
  let targetsSource: RankingSummary["targetsSource"] = "ai";
  try {
    targets = await ensureTargets(db, deps, s, log);
  } catch (err) {
    log(`ranking: targets AI failed (${(err as Error).message.slice(0, 200)})`);
    targets = (await loadTargets(db))?.data ?? null;
    targetsSource = targets ? "cached" : "fallback";
  }

  const cands = await loadCandidates(db);
  const { scored, forYou } = rankAll(cands, s, targets);
  log(`ranking: ${cands.length} candidates, ${scored.length} relevant, ${forYou.length} in For You`);

  const reasons = await writeReasons(db, deps, forYou, log);

  const { data: run, error } = await db
    .from("ranking_runs")
    .insert({ settings_hash: settingsHash(s), item_count: scored.length })
    .select("id")
    .single();
  if (error) throw new Error(`ranking_runs: ${error.message}`);

  const forYouRank = new Map(forYou.map((x, i) => [x.c.key, i + 1]));
  const rows = scored.map((x) => {
    const rank = forYouRank.get(x.c.key) ?? null;
    return {
      run_id: run.id,
      item_key: x.c.key,
      category: x.c.category,
      score: x.score,
      breakdown: x.breakdown,
      for_you_rank: rank,
      snapshot: rank
        ? {
            title: x.c.title,
            url: x.c.url,
            image_url: x.c.imageUrl,
            retailer_name: x.c.retailerName,
            melbourne_pickup: x.c.melbournePickup,
            price_cents: x.c.priceCents, // scraped price
            prev_price_cents: x.c.prevPriceCents,
            drop_cents: x.c.dropCents,
            parts_cents: x.c.partsCents ?? null,
            price_dropped: x.c.priceDropped,
            is_new_listing: x.c.isNew,
            source: x.c.source,
            votes: x.c.votes ?? null,
            reason: reasons.get(x.c.key) ?? null,
          }
        : null,
    };
  });
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from("ranking_items").insert(rows.slice(i, i + 500));
    if (e) throw new Error(`ranking_items: ${e.message}`);
  }

  // prune old runs
  const { data: old } = await db
    .from("ranking_runs")
    .select("id")
    .order("id", { ascending: false })
    .range(rankingConfig.keepRankingRuns, rankingConfig.keepRankingRuns + 100);
  if (old?.length) await db.from("ranking_runs").delete().in("id", old.map((o) => o.id));

  return { status: "ok", runId: run.id, scored: scored.length, forYou: forYou.length, targetsSource };
}
