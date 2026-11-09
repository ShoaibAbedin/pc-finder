import "server-only";
import type { BuildResult } from "../build/assembler";
import type { DealListing } from "./queries";
import { createServiceClient } from "../db/client";

export interface ForYouItem {
  key: string;
  rank: number;
  score: number;
  category: string;
  /** null = new to For You; positive = moved up by n places; negative = moved down */
  change: number | null;
  title: string;
  url: string;
  image_url: string | null;
  retailer_name: string | null;
  melbourne_pickup: boolean;
  price_cents: number | null;
  prev_price_cents: number | null;
  drop_cents: number | null;
  parts_cents: number | null;
  price_dropped: boolean;
  is_new_listing: boolean;
  source: "product" | "oz";
  votes: number | null;
  reason: string | null;
  also?: { retailer: string; priceCents: number; url: string }[];
}

export interface HomeData {
  items: ForYouItem[];
  rankedAt: string | null;
  hasPrevious: boolean;
  builds: BuildResult | null;
  prevBestTotal: number | null;
  /** Precomputed at the last update; null if that update predates precomputation. */
  drops: DealListing[] | null;
}

/** Everything the home page needs, from the last two ranking runs (one small query + two item queries). */
export async function getHomeData(): Promise<HomeData> {
  const db = createServiceClient();
  const { data: runs, error } = await db
    .from("ranking_runs")
    .select("id, created_at, builds, drops")
    .order("id", { ascending: false })
    .limit(2);
  if (error) throw new Error(`ranking_runs: ${error.message}`);
  if (!runs?.length) return { items: [], rankedAt: null, hasPrevious: false, builds: null, prevBestTotal: null, drops: null };

  const [latest, previous] = runs;
  const [cur, prev] = await Promise.all([
    db.from("ranking_items").select("item_key, category, score, for_you_rank, snapshot").eq("run_id", latest!.id).not("for_you_rank", "is", null).order("for_you_rank"),
    previous
      ? db.from("ranking_items").select("item_key, for_you_rank").eq("run_id", previous.id).not("for_you_rank", "is", null)
      : Promise.resolve({ data: [] as { item_key: string; for_you_rank: number }[], error: null }),
  ]);
  if (cur.error) throw new Error(cur.error.message);

  const prevRank = new Map((prev.data ?? []).map((r) => [r.item_key, r.for_you_rank as number]));
  const items: ForYouItem[] = (cur.data ?? []).map((r) => {
    const p = prevRank.get(r.item_key);
    return {
      key: r.item_key,
      rank: r.for_you_rank,
      score: r.score,
      category: r.category,
      change: previous ? (p === undefined ? null : p - r.for_you_rank) : 0,
      ...(r.snapshot as Omit<ForYouItem, "key" | "rank" | "score" | "category" | "change">),
    };
  });
  const prevBuilds = previous?.builds as BuildResult | null | undefined;
  return {
    items,
    rankedAt: latest!.created_at,
    hasPrevious: !!previous,
    builds: (latest!.builds as BuildResult | null) ?? null,
    prevBestTotal: prevBuilds?.builds?.find((b) => b.label === "best")?.totalCents ?? null,
    drops: (latest!.drops as DealListing[] | null) ?? null,
  };
}

export async function hasSettings(): Promise<boolean> {
  const { count } = await createServiceClient().from("app_settings").select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}
