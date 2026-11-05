import "server-only";
import { createServiceClient } from "../db/client";
import { PAGE_SIZE, searchTerms, type DealFilters } from "./filters";

export interface DealListing {
  id: number;
  retailer_id: string;
  retailer_name: string;
  melbourne_pickup: boolean;
  title: string;
  url: string;
  category: string;
  image_url: string | null;
  current_price_cents: number | null;
  in_stock: boolean | null;
  status: "active" | "out_of_stock" | "expired";
  first_seen_at: string;
  prev_price_cents: number | null;
  current_price_since: string | null;
  drop_cents: number | null;
  drop_pct: number | null;
  price_dropped: boolean | null;
  is_new: boolean | null;
  is_30d_low: boolean | null;
  match_score?: number | null;
}

export interface OzDealListing {
  node_id: string;
  title: string;
  link: string;
  store: string | null;
  retailer_id: string | null;
  retailer_name: string | null;
  price_cents: number | null;
  category: string;
  votes_pos: number;
  votes_neg: number;
  comment_count: number;
  image_url: string | null;
  posted_at: string | null;
  expires_at: string | null;
  is_new: boolean | null;
}

export interface RetailerOption {
  id: string;
  name: string;
  melbourne_pickup: boolean;
  listing_count: number;
}

const LISTING_COLS =
  "id,retailer_id,retailer_name,melbourne_pickup,title,url,category,image_url,current_price_cents,in_stock,status,first_seen_at,prev_price_cents,current_price_since,drop_cents,drop_pct,price_dropped,is_new,is_30d_low";
const OZ_COLS =
  "node_id,title,link,store,retailer_id,retailer_name,price_cents,category,votes_pos,votes_neg,comment_count,image_url,posted_at,expires_at,is_new";

let _db: ReturnType<typeof createServiceClient> | undefined;
const db = () => (_db ??= createServiceClient());

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

export async function getListings(
  category: string,
  f: DealFilters,
): Promise<{ items: DealListing[]; total: number }> {
  let q = db()
    .from("deal_listings_ranked")
    .select(`${LISTING_COLS},match_score`, { count: "exact" })
    .neq("status", "expired");

  if (category !== "all") q = q.eq("category", category);
  if (f.inStockOnly) q = q.eq("status", "active");
  if (f.minDollars !== undefined) q = q.gte("current_price_cents", f.minDollars * 100);
  if (f.maxDollars !== undefined) q = q.lte("current_price_cents", f.maxDollars * 100);
  if (f.retailers.length) q = q.in("retailer_id", f.retailers);
  if (f.pickupOnly) q = q.eq("melbourne_pickup", true);
  for (const w of searchTerms(f.q)) q = q.ilike("title", `%${w}%`);

  switch (f.sort) {
    case "price_asc":
      q = q.order("current_price_cents", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      q = q.order("current_price_cents", { ascending: false, nullsFirst: false });
      break;
    case "new":
      q = q.order("first_seen_at", { ascending: false });
      break;
    case "match":
      q = q
        .order("match_score", { ascending: false, nullsFirst: false })
        .order("drop_pct", { ascending: false, nullsFirst: false });
      break;
    default:
      q = q
        .order("drop_pct", { ascending: false, nullsFirst: false })
        .order("current_price_since", { ascending: false, nullsFirst: false });
  }
  q = q.order("id", { ascending: true }); // stable paging

  const from = (f.page - 1) * PAGE_SIZE;
  const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) fail("getListings", error);
  return { items: (data ?? []) as unknown as DealListing[], total: count ?? 0 };
}

/** Products with a real price drop (vs our history) in the last `days` days, biggest first. */
export async function getPriceDrops(limit: number, days = 30): Promise<DealListing[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("deal_listings")
    .select(LISTING_COLS)
    .eq("status", "active")
    .not("drop_pct", "is", null)
    .gte("current_price_since", since)
    .order("drop_pct", { ascending: false })
    .limit(limit);
  if (error) fail("getPriceDrops", error);
  return (data ?? []) as unknown as DealListing[];
}

export async function getNewListings(limit: number): Promise<DealListing[]> {
  const { data, error } = await db()
    .from("deal_listings")
    .select(LISTING_COLS)
    .eq("status", "active")
    .eq("is_new", true)
    .order("first_seen_at", { ascending: false })
    .limit(limit);
  if (error) fail("getNewListings", error);
  return (data ?? []) as unknown as DealListing[];
}

export async function getOzDeals(opts: {
  category?: string;
  limit: number;
  filters?: DealFilters;
  days?: number;
}): Promise<OzDealListing[]> {
  let q = db().from("oz_deal_listings").select(OZ_COLS).eq("status", "active");
  if (opts.category && opts.category !== "all") q = q.eq("category", opts.category);
  else q = q.neq("category", "other"); // laptops, routers, phones etc. aren't PC parts
  if (opts.days) q = q.gte("posted_at", new Date(Date.now() - opts.days * 86_400_000).toISOString());
  const f = opts.filters;
  if (f) {
    if (f.minDollars !== undefined) q = q.gte("price_cents", f.minDollars * 100);
    if (f.maxDollars !== undefined) q = q.lte("price_cents", f.maxDollars * 100);
    if (f.retailers.length) q = q.in("retailer_id", f.retailers);
    if (f.pickupOnly) q = q.eq("melbourne_pickup", true);
    for (const w of searchTerms(f.q)) q = q.ilike("title", `%${w}%`);
  }
  const { data, error } = await q
    .order("votes_pos", { ascending: false })
    .order("posted_at", { ascending: false })
    .limit(opts.limit);
  if (error) fail("getOzDeals", error);
  return (data ?? []) as unknown as OzDealListing[];
}

export async function getRetailerOptions(): Promise<RetailerOption[]> {
  const { data, error } = await db()
    .from("retailer_stats")
    .select("id,name,melbourne_pickup,listing_count")
    .eq("kind", "retailer")
    .gt("listing_count", 0)
    .order("name");
  if (error) fail("getRetailerOptions", error);
  return (data ?? []) as RetailerOption[];
}

/** Most recent successful scrape finish time across all sources. */
export async function getLastUpdated(): Promise<string | null> {
  const { data, error } = await db()
    .from("scrape_runs")
    .select("finished_at")
    .in("status", ["ok", "partial"])
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1);
  if (error) fail("getLastUpdated", error);
  return data?.[0]?.finished_at ?? null;
}
