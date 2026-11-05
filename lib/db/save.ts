import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, OzDeal, RawListing } from "../../scrapers/core/types";
import { classifyListing, statusFor, type ExistingProduct } from "./diff";

const CHUNK = 200;

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export interface SaveListingsResult {
  found: number;
  new: number;
  changed: number;
}

/**
 * Upserts products for one retailer and appends price_history rows ONLY for new/changed listings.
 * `seenAt` must be the same timestamp for the whole run (used later by expiry).
 */
export async function saveListings(
  db: SupabaseClient,
  retailerId: string,
  listings: RawListing[],
  seenAt: string,
): Promise<SaveListingsResult> {
  const result: SaveListingsResult = { found: listings.length, new: 0, changed: 0 };

  for (const batch of chunks(listings)) {
    const existingRows = check(
      await db
        .from("products")
        .select("id, external_id, current_price_cents, in_stock, status, last_changed_at")
        .eq("retailer_id", retailerId)
        .in(
          "external_id",
          batch.map((l) => l.externalId),
        ),
      "load existing products",
    ) as ExistingProduct[];
    const existing = new Map(existingRows.map((r) => [r.external_id, r]));

    const kinds = new Map<string, ReturnType<typeof classifyListing>>();
    const rows = batch.map((l) => {
      const prev = existing.get(l.externalId);
      const kind = classifyListing(prev, l);
      kinds.set(l.externalId, kind);
      if (kind === "new") result.new++;
      else if (kind === "changed") result.changed++;
      return {
        retailer_id: retailerId,
        external_id: l.externalId,
        sku: l.sku ?? null,
        title: l.title,
        url: l.url,
        category: l.category,
        brand: l.brand ?? null,
        image_url: l.imageUrl ?? null,
        current_price_cents: l.priceCents,
        retailer_was_price_cents: l.retailerWasPriceCents ?? null,
        in_stock: l.inStock,
        status: statusFor(l),
        missed_runs: 0,
        last_seen_at: seenAt,
        last_changed_at: kind === "unchanged" && prev ? prev.last_changed_at : seenAt,
        expired_at: null,
      };
    });

    const upserted = check(
      await db.from("products").upsert(rows, { onConflict: "retailer_id,external_id" }).select("id, external_id"),
      "upsert products",
    ) as { id: number; external_id: string }[];

    const history = upserted
      .filter((r) => kinds.get(r.external_id) !== "unchanged")
      .map((r) => {
        const l = batch.find((x) => x.externalId === r.external_id)!;
        return { product_id: r.id, price_cents: l.priceCents, in_stock: l.inStock, recorded_at: seenAt };
      });
    if (history.length) check(await db.from("price_history").insert(history), "insert price_history");
  }
  return result;
}

/** Expires products missing from fully-scraped categories. Returns number newly expired. */
export async function expireMissingProducts(
  db: SupabaseClient,
  retailerId: string,
  categories: Category[],
  seenAt: string,
  threshold: number,
): Promise<number> {
  if (!categories.length) return 0;
  const n = check(
    await db.rpc("mark_missing_products", {
      p_retailer_id: retailerId,
      p_categories: categories,
      p_seen_before: seenAt,
      p_threshold: threshold,
    }),
    "mark_missing_products",
  );
  return Number(n) || 0;
}

export async function saveOzDeals(
  db: SupabaseClient,
  deals: OzDeal[],
  seenAt: string,
): Promise<{ found: number; new: number }> {
  let isNew = 0;
  for (const batch of chunks(deals)) {
    const known = check(
      await db.from("ozbargain_deals").select("node_id").in(
        "node_id",
        batch.map((d) => d.nodeId),
      ),
      "load existing deals",
    ) as { node_id: string }[];
    const knownIds = new Set(known.map((k) => k.node_id));
    isNew += batch.filter((d) => !knownIds.has(d.nodeId)).length;

    const rows = batch.map((d) => ({
      node_id: d.nodeId,
      title: d.title,
      link: d.link,
      deal_url: d.dealUrl ?? null,
      store: d.store ?? null,
      retailer_id: d.retailerId ?? null,
      price_cents: d.priceCents,
      category: d.category,
      tags: d.tags,
      votes_pos: d.votesPos,
      votes_neg: d.votesNeg,
      comment_count: d.commentCount,
      image_url: d.imageUrl ?? null,
      posted_at: d.postedAt ?? null,
      expires_at: d.expiresAt ?? null,
      status: d.expired ? "expired" : "active",
      expired_at: d.expired ? seenAt : null,
      last_seen_at: seenAt,
    }));
    check(await db.from("ozbargain_deals").upsert(rows, { onConflict: "node_id" }), "upsert ozbargain_deals");
  }
  return { found: deals.length, new: isNew };
}

export async function expireOzDeals(db: SupabaseClient, staleDays: number): Promise<number> {
  return Number(check(await db.rpc("expire_ozbargain_deals", { p_stale_days: staleDays }), "expire_ozbargain_deals")) || 0;
}

export async function startRun(db: SupabaseClient, sourceId: string, startedAt: string): Promise<number> {
  const row = check(
    await db.from("scrape_runs").insert({ source_id: sourceId, started_at: startedAt }).select("id").single(),
    "start run",
  ) as { id: number };
  return row.id;
}

export async function finishRun(
  db: SupabaseClient,
  runId: number,
  fields: {
    status: "ok" | "partial" | "blocked" | "error";
    items_found?: number;
    items_new?: number;
    items_changed?: number;
    items_expired?: number;
    requests?: number;
    message?: string | null;
  },
) {
  check(
    await db
      .from("scrape_runs")
      .update({ ...fields, finished_at: new Date().toISOString() })
      .eq("id", runId),
    "finish run",
  );
}
