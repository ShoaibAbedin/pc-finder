import type { Specs } from "../ai/specs";
import type { Targets } from "../ai/targets";
import { BUILD_CATEGORIES, isVictoria, type Settings } from "../settings/schema";
import { rankingConfig as C } from "./config";
import { sameProduct } from "./match";

export interface Candidate {
  key: string; // "p:<id>" | "oz:<node id>"
  source: "product" | "oz";
  category: string;
  title: string;
  url: string;
  imageUrl: string | null;
  retailerId: string | null;
  retailerName: string | null;
  melbournePickup: boolean;
  priceCents: number | null; // scraped only
  status: "active" | "out_of_stock";
  inStock: boolean | null;
  prevPriceCents: number | null;
  dropCents: number | null;
  dropPct: number | null;
  high30Cents: number | null;
  historyPoints: number;
  is30dLow: boolean;
  priceDropped: boolean;
  isNew: boolean;
  votes?: number;
  specs?: Specs;
  /** For prebuilts: total of cheapest matching in-stock parts (scraped prices). */
  partsCents?: number | null;
}

export interface Breakdown {
  fit: number;
  budget: number;
  discount: number;
  convenience: number;
  stock: number;
  /** Plain-English facts behind the score; also fed to the AI reason writer. */
  notes: string[];
}

export interface Scored {
  c: Candidate;
  score: number;
  breakdown: Breakdown;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-AU")}`;
const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

/* ---------------- budgets ---------------- */

const PERIPHERAL_KEYS = ["keyboard", "mouse", "headset"] as const;

/** Budget per category in cents. Explicit per-category limits always win over the AI/default split. */
export function categoryBudgets(s: Settings, t: Targets | null): Record<string, number> {
  const total = s.budget.total * 100;
  const split: Record<string, number> = { ...(t?.budget_split_pct ?? {}) };
  for (const cat of BUILD_CATEGORIES) if (split[cat] === undefined) split[cat] = C.defaultSplitPct[cat] ?? 5;
  if (split.prebuilt === undefined)
    split.prebuilt = BUILD_CATEGORIES.reduce((a, c) => a + (s.owned.categories.includes(c) ? 0 : split[c] ?? 0), 0);
  for (const [k, v] of Object.entries(C.defaultExtrasPct)) if (split[k] === undefined) split[k] = v;

  const out: Record<string, number> = {};
  for (const [cat, pct] of Object.entries(split)) out[cat] = Math.round((total * pct) / 100);
  for (const [cat, limit] of Object.entries(s.budget.perCategory)) if (limit) out[cat] = limit * 100;
  // Peripheral budget covers each requested peripheral type individually.
  const nPeriph = PERIPHERAL_KEYS.filter((k) => s.extras[k]).length;
  if (nPeriph > 1 && out.peripheral) out.peripheral = Math.round(out.peripheral / nPeriph);
  return out;
}

/* ---------------- relevance ---------------- */

export function excludeReason(c: Candidate, s: Settings): string | null {
  const sp = c.specs;
  if (c.priceCents === null) return "no price";
  if (c.category === "other") return "not a PC category";
  if (sp && sp.relevant === false) return "not relevant";
  if ((s.owned.categories as string[]).includes(c.category)) return "already owned";
  const isBuildPart = (BUILD_CATEGORIES as readonly string[]).includes(c.category);
  if (isBuildPart && s.mode === "prebuilt") return "prebuilt mode";
  if (c.category === "prebuilt" && s.mode === "build") return "build mode";
  if (c.category === "monitor" && !s.extras.monitor) return "monitor not wanted";
  if (c.category === "software" && !s.extras.windows) return "windows not wanted";
  if (c.category === "peripheral") {
    const wanted = PERIPHERAL_KEYS.filter((k) => s.extras[k]);
    if (!wanted.length) return "peripherals not wanted";
    const type = lc(sp?.peripheral_type);
    if (type && !wanted.some((w) => type.includes(w))) return "peripheral type not wanted";
  }
  const brand = lc(sp?.brand) || lc(c.title.split(" ")[0]);
  if (s.requirements.avoidBrands.some((b) => brand.includes(lc(b)) || lc(c.title).includes(` ${lc(b)} `)))
    return "avoided brand";
  return null;
}

/* ---------------- components ---------------- */

function fitScore(c: Candidate, s: Settings, t: Targets | null, notes: string[]): number {
  const sp = c.specs;
  const target = t?.targets[c.category];
  const title = lc(c.title);
  let fit = 0.5;

  if (sp?.tier && target) {
    const tier = sp.tier;
    if (tier < target.min_tier) fit = 0.25 * (tier / target.min_tier);
    else fit = 1 - Math.min(1, Math.abs(tier - target.ideal_tier) / 4) * 0.6;
    if (Math.abs(tier - target.ideal_tier) <= 1 && tier >= target.min_tier) notes.push(`right tier for your build (${sp.model ?? c.category})`);
    else if (tier < target.min_tier) notes.push("below your target tier");
  }
  if (target) {
    const hay = `${title} ${lc(sp?.model)} ${lc(sp?.gpu_chip)} ${lc(sp?.cpu_model)}`;
    if (target.prefer.some((p) => p && hay.includes(lc(p)))) {
      fit += 0.15;
      notes.push("matches a recommended model");
    }
    if (target.avoid.some((p) => p && hay.includes(lc(p)))) fit -= 0.4;
  }

  const brand = lc(sp?.brand) || title;
  if (s.requirements.preferredBrands.some((b) => brand.includes(lc(b)))) {
    fit += 0.1;
    notes.push("preferred brand");
  }

  const r = s.requirements;
  const colourMatters = ["case", "cooling", "peripheral", "ram", "prebuilt", "psu", "motherboard"].includes(c.category);
  if (r.colour !== "any" && colourMatters) {
    const colour = lc(sp?.colour) || (title.includes("white") ? "white" : title.includes("black") ? "black" : "");
    if (colour === r.colour) {
      fit += 0.1;
      notes.push(`${r.colour} as requested`);
    } else if (colour) fit -= 0.25;
  }
  if (r.wifi && (c.category === "motherboard" || c.category === "prebuilt")) {
    const wifi = sp?.wifi ?? (/(wi-?fi|wireless)/i.test(c.title) ? true : null);
    if (wifi === true) notes.push("has Wi-Fi");
    else if (wifi === false || c.category === "motherboard") fit -= 0.3;
  }
  if (r.quiet && ["cooling", "case", "psu", "prebuilt"].includes(c.category) && (sp?.quiet || /silent|quiet|be quiet|noctua/i.test(c.title))) {
    fit += 0.1;
    notes.push("quiet-focused");
  }
  if (r.rgb === "no" && sp?.rgb === true) fit -= 0.15;
  if (r.rgb === "yes" && sp?.rgb === true) fit += 0.05;

  if (r.size !== "any" && (c.category === "case" || c.category === "motherboard")) {
    const ff = lc(sp?.form_factor);
    const ok =
      r.size === "sff" ? /itx/.test(ff) : r.size === "compact" ? /(matx|micro|itx)/.test(ff) : r.size === "full" ? /(e-?atx|full|atx)/.test(ff) : true;
    if (ff && !ok) fit -= 0.3;
  }

  const plat = t?.platform;
  if (plat?.socket && (c.category === "cpu" || c.category === "motherboard") && sp?.socket) {
    if (lc(sp.socket) !== lc(plat.socket)) fit -= 0.3;
  }
  if (plat?.ram_type && (c.category === "ram" || c.category === "motherboard") && sp?.ram_type) {
    if (lc(sp.ram_type) !== lc(plat.ram_type)) fit -= 0.4;
  }
  if (c.category === "ram" && /so-?dimm|laptop|notebook/i.test(c.title)) fit -= 0.6;

  // Gaming prebuilts need a real graphics card; office mini PCs/NUCs don't qualify.
  if (c.category === "prebuilt" && s.uses.gaming) {
    const gpu = lc(sp?.pb_gpu) || (/(rtx|gtx|rx ?\d{4}|radeon rx|arc [ab]\d)/i.test(c.title) ? "dgpu" : "");
    const integrated = !gpu || /integrated|iris|uhd|radeon graphics|intel graphics|arc graphics/.test(gpu);
    if (integrated) {
      fit -= 0.7;
      notes.push("no dedicated graphics card");
    }
    if (/\b(nuc|mini ?pc|tiny|micro desktop|thin client|stick)\b/i.test(c.title)) fit -= 0.3;
  }
  // Portable / tiny monitors aren't desk monitors.
  if (c.category === "monitor" && ((sp?.screen_in && sp.screen_in < 21) || /portable/i.test(c.title))) fit -= 0.6;
  if (plat?.min_psu_w && c.category === "psu" && sp?.wattage && sp.wattage < plat.min_psu_w) fit -= 0.5;

  if (c.category === "monitor" && t?.monitor) {
    if (t.monitor.resolution && sp?.resolution && !lc(sp.resolution).includes(lc(t.monitor.resolution).replace("ultrawide ", ""))) fit -= 0.3;
    if (t.monitor.min_refresh_hz && sp?.refresh_hz && sp.refresh_hz < t.monitor.min_refresh_hz) fit -= 0.2;
  }
  return clamp(fit);
}

function budgetScore(c: Candidate, budget: number | undefined, notes: string[]): number {
  if (!budget || !c.priceCents) return 0.5;
  const r = c.priceCents / budget;
  if (r <= 1) {
    notes.push(`within your ${dollars(budget)} ${c.category === "prebuilt" ? "prebuilt" : c.category} budget`);
    return 1;
  }
  notes.push(`${Math.round((r - 1) * 100)}% over budget`);
  return clamp(1 - (r - 1) / (C.maxOverBudget - 1));
}

function discountScore(c: Candidate, notes: string[]): number {
  let d = 0;
  if (c.source === "oz") {
    const v = c.votes ?? 0;
    d = 0.2 + 0.8 * clamp(v / C.fullOzVotes);
    notes.push(`+${v} votes on OzBargain`);
    return clamp(d);
  }
  const price = c.priceCents ?? 0;
  if (c.high30Cents && c.historyPoints > 1 && c.high30Cents > price) {
    const pct = (c.high30Cents - price) / c.high30Cents;
    d = clamp(pct / C.fullDiscountPct);
    notes.push(`${Math.round(pct * 100)}% below its 30-day high (${dollars(c.high30Cents)})`);
  }
  if (c.is30dLow && c.historyPoints > 1) {
    d += 0.2;
    notes.push("lowest price in 30 days");
  }
  if (c.category === "prebuilt" && c.partsCents && price) {
    const saving = (c.partsCents - price) / c.partsCents;
    if (saving > 0) {
      d = Math.max(d, clamp(saving / 0.15));
      notes.push(`${dollars(c.partsCents - price)} cheaper than buying the parts`);
    } else notes.push(`${dollars(price - c.partsCents)} more than buying the parts`);
  }
  return clamp(d);
}

function convenienceScore(c: Candidate, s: Settings, notes: string[]): number {
  if (c.melbournePickup && isVictoria(s)) {
    notes.push(`click & collect in Melbourne (${c.retailerName})`);
    return 1;
  }
  if (c.retailerId) return 0.6;
  return 0.3; // marketplace / unknown store
}

function stockScore(c: Candidate): number {
  if (c.status === "out_of_stock" || c.inStock === false) return 0;
  if (c.inStock === true) return 1;
  return c.source === "oz" ? 0.8 : 0.6;
}

/* ---------------- main ---------------- */

export function scoreCandidate(
  c: Candidate,
  s: Settings,
  t: Targets | null,
  budgets: Record<string, number>,
): Scored | null {
  if (excludeReason(c, s)) return null;
  const budget = budgets[c.category];
  if (budget && c.priceCents! > budget * C.maxOverBudget) return null;

  const notes: string[] = [];
  const b: Breakdown = {
    fit: fitScore(c, s, t, notes),
    budget: budgetScore(c, budget, notes),
    discount: discountScore(c, notes),
    convenience: convenienceScore(c, s, notes),
    stock: stockScore(c),
    notes,
  };
  const w = C.weights;
  const score =
    b.fit * w.fit + b.budget * w.budget + b.discount * w.discount + b.convenience * w.convenience + b.stock * w.stock;
  return { c, score: Math.round(score * 10) / 10, breakdown: b };
}

/**
 * Top N in-stock items. Ordered by score × category importance (a great GPU deal matters more than a
 * great case deal), with per-category caps so cheap parts can't crowd the list.
 */
export function selectForYou(scored: Scored[], size = C.forYouSize, maxPerCategory = C.forYouMaxPerCategory): Scored[] {
  const perCat = new Map<string, number>();
  const seenTitles = new Set<string>();
  const out: Scored[] = [];
  const weight = (x: Scored) => x.score * (C.categoryImportance[x.c.category] ?? 0.7);
  const cap = (cat: string) => C.categoryCap[cat] ?? maxPerCategory;
  for (const x of [...scored].sort((a, b) => weight(b) - weight(a))) {
    if (x.breakdown.stock === 0) continue;
    if (x.breakdown.fit < 0.35) continue; // poor fits never make For You, however cheap
    const n = perCat.get(x.c.category) ?? 0;
    if (n >= Math.min(maxPerCategory, cap(x.c.category))) continue;
    const t = lc(x.c.title).replace(/\s+/g, " ").slice(0, 80);
    if (seenTitles.has(t)) continue; // same product listed twice
    if (out.some((y) => sameProduct(y.c, x.c))) continue; // same product at another store — shown via "Also at"
    seenTitles.add(t);
    perCat.set(x.c.category, n + 1);
    out.push(x);
    if (out.length >= size) break;
  }
  return out;
}

export interface OtherOffer {
  retailer: string;
  priceCents: number;
  url: string;
}

/** Other in-stock offers of the same product (cheapest first), for the "Also at" line. */
export function otherOffers(x: Scored, all: Scored[], max = 3): OtherOffer[] {
  return all
    .filter((y) => y.c.key !== x.c.key && y.c.source === "product" && y.breakdown.stock > 0 && y.c.priceCents && sameProduct(x.c, y.c))
    .sort((a, b) => a.c.priceCents! - b.c.priceCents!)
    .filter((y, i, arr) => arr.findIndex((z) => z.c.retailerName === y.c.retailerName) === i) // one per store
    .filter((y) => y.c.retailerName !== x.c.retailerName)
    .slice(0, max)
    .map((y) => ({ retailer: y.c.retailerName ?? "?", priceCents: y.c.priceCents!, url: y.c.url }));
}

/** Deterministic fallback reason (used when AI is unavailable or its output fails validation). */
export function templateReason(x: Scored): string {
  const n = x.breakdown.notes;
  const pick = n.filter((s) => !/over budget|below your target|more than buying/.test(s)).slice(0, 2);
  const text = pick.length ? pick.join(", ") : "solid match for your build";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
