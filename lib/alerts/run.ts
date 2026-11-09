import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuildResult } from "../build/assembler";
import { searchTerms } from "../deals/filters";
import { formatPrice } from "../format";
import { sendPush, type Push } from "./notify";

export interface AlertSettings {
  ntfy_topic: string;
  notify_build: boolean;
  build_drop_cents: number;
  notify_top_picks: boolean;
  top_pick_drop_pct: number;
}

export interface Watch {
  id: number;
  query: string;
  category: string | null;
  max_price_cents: number;
  active: boolean;
}

interface Pending extends Push {
  key: string;
}

const MAX_PER_RUN = 6; // never spam: at most this many pushes per update

export async function loadAlertSettings(db: SupabaseClient): Promise<AlertSettings | null> {
  const { data } = await db.from("alert_settings").select("*").eq("id", 1).maybeSingle();
  return (data as AlertSettings) ?? null;
}

/* ---------------- pure decision helpers (unit tested) ---------------- */

export function buildDropAlert(latest: BuildResult | null, previous: BuildResult | null, minDropCents: number, runId: number): Pending | null {
  const now = latest?.builds.find((b) => b.label === "best");
  const before = previous?.builds.find((b) => b.label === "best");
  if (!now || !before) return null;
  const drop = before.totalCents - now.totalCents;
  if (drop < minDropCents) return null;
  const gpu = now.parts.find((p) => p.category === "gpu");
  return {
    key: `build:${runId}`,
    title: `Your build dropped ${formatPrice(drop)} - now ${formatPrice(now.totalCents)}`,
    message: `Best compatible build is now ${formatPrice(now.totalCents)} (was ${formatPrice(before.totalCents)}).${gpu ? `\nGPU: ${gpu.title} - ${formatPrice(gpu.priceCents)} at ${gpu.retailer}` : ""}`,
    tags: ["chart_with_downwards_trend"],
    priority: 4,
  };
}

export interface TopPickSnapshot {
  item_key: string;
  snapshot: { title: string; url: string; price_cents: number | null; prev_price_cents: number | null; drop_cents: number | null; price_dropped: boolean; retailer_name: string | null };
}

export function topPickAlerts(items: TopPickSnapshot[], minPct: number): Pending[] {
  const out: Pending[] = [];
  for (const { item_key, snapshot: s } of items) {
    if (!s.price_dropped || !s.drop_cents || !s.prev_price_cents || !s.price_cents) continue;
    const pct = Math.round((100 * s.drop_cents) / s.prev_price_cents);
    if (pct < minPct) continue;
    out.push({
      key: `drop:${item_key}:${s.price_cents}`,
      title: `${pct}% off a top pick: ${formatPrice(s.price_cents)}`,
      message: `${s.title}\n${formatPrice(s.price_cents)} at ${s.retailer_name ?? "?"} (was ${formatPrice(s.prev_price_cents)} in our history)`,
      url: s.url,
      tags: ["moneybag"],
      priority: 4,
    });
  }
  return out;
}

/* ---------------- runner ---------------- */

async function watchMatches(db: SupabaseClient, w: Watch, retailerNames: Map<string, string>): Promise<Pending | null> {
  let q = db
    .from("products")
    .select("id, title, url, current_price_cents, retailer_id, seller_name")
    .eq("status", "active")
    .neq("in_stock", false)
    .lte("current_price_cents", w.max_price_cents)
    .order("current_price_cents", { ascending: true })
    .limit(1);
  if (w.category) q = q.eq("category", w.category);
  const terms = searchTerms(w.query);
  if (!terms.length) return null;
  for (const t of terms) q = q.ilike("title", `%${t}%`);
  const { data } = await q;
  const p = data?.[0];
  if (!p) return null;
  const store = p.seller_name ?? retailerNames.get(p.retailer_id) ?? p.retailer_id;
  return {
    key: `watch:${w.id}:${p.id}:${p.current_price_cents}`,
    title: `"${w.query}" under ${formatPrice(w.max_price_cents)}: ${formatPrice(p.current_price_cents)}`,
    message: `${p.title}\n${formatPrice(p.current_price_cents)} at ${store}`,
    url: p.url,
    tags: ["bell"],
    priority: 4,
  };
}

/** Checks all alert rules after an update and pushes anything new. Returns how many were sent. */
export async function runAlerts(db: SupabaseClient, log: (m: string) => void = () => {}): Promise<number> {
  const settings = await loadAlertSettings(db);
  if (!settings) {
    log("alerts: not set up");
    return 0;
  }
  const pending: Pending[] = [];

  const { data: runs } = await db.from("ranking_runs").select("id, builds").order("id", { ascending: false }).limit(2);
  const [latest, previous] = runs ?? [];
  if (settings.notify_build && latest) {
    const a = buildDropAlert(latest.builds as BuildResult | null, (previous?.builds as BuildResult | null) ?? null, settings.build_drop_cents, latest.id);
    if (a) pending.push(a);
  }
  if (settings.notify_top_picks && latest) {
    const { data: items } = await db
      .from("ranking_items")
      .select("item_key, snapshot")
      .eq("run_id", latest.id)
      .not("for_you_rank", "is", null);
    pending.push(...topPickAlerts((items ?? []) as TopPickSnapshot[], settings.top_pick_drop_pct));
  }

  const { data: watches } = await db.from("alert_watches").select("*").eq("active", true);
  if (watches?.length) {
    const { data: rs } = await db.from("retailers").select("id, name");
    const names = new Map((rs ?? []).map((r) => [r.id as string, r.name as string]));
    for (const w of watches as Watch[]) {
      const m = await watchMatches(db, w, names);
      if (m) pending.push(m);
    }
  }

  if (!pending.length) {
    log("alerts: nothing new");
    return 0;
  }
  // Skip anything already announced
  const { data: sent } = await db.from("alert_log").select("alert_key").in("alert_key", pending.map((p) => p.key));
  const already = new Set((sent ?? []).map((s) => s.alert_key));
  const fresh = pending.filter((p) => !already.has(p.key)).slice(0, MAX_PER_RUN);

  let n = 0;
  for (const p of fresh) {
    try {
      await sendPush(settings.ntfy_topic, p);
      await db.from("alert_log").insert({ alert_key: p.key, title: p.title, body: p.message, url: p.url ?? null });
      n++;
    } catch (err) {
      log(`alerts: failed to send "${p.title}": ${(err as Error).message}`);
    }
  }
  log(`alerts: ${n} sent (${pending.length - fresh.length} already sent before)`);
  return n;
}
