import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { BlockedError } from "../core/fetcher";
import { toCents } from "../core/price";
import { matchRetailer } from "../core/retailers";
import type { Category, RawListing, ScraperModule } from "../core/types";

const BASE = "https://www.staticice.com.au";

/** Stores we scrape directly — skipped here to avoid duplicate listings. */
// PCCG/Scorptec block cloud servers, so their prices come through StaticICE instead (cross-store
// matching dedupes them if their own scrapers work again).
const SCRAPED_DIRECTLY = new Set(["mwave", "umart", "msy"]);

/** Used when there are no AI build targets yet. */
export const DEFAULT_QUERIES: { category: Category; q: string }[] = [
  { category: "gpu", q: "rtx 5070" },
  { category: "gpu", q: "rx 9070 xt" },
  { category: "gpu", q: "rtx 5060 ti 16gb" },
  { category: "cpu", q: "ryzen 7 9800x3d" },
  { category: "cpu", q: "ryzen 5 9600x" },
  { category: "motherboard", q: "b850 motherboard" },
  { category: "ram", q: "32gb ddr5 6000" },
  { category: "storage", q: "2tb nvme gen4" },
  { category: "psu", q: "850w gold" },
  { category: "monitor", q: "27 1440p 180hz monitor" },
];

const MAX_QUERIES = 15;

/** Builds search terms from the AI targets' recommended models (falls back to defaults). */
export function queriesFromTargets(targets: { targets: Record<string, { prefer: string[] }> } | null): { category: Category; q: string }[] {
  if (!targets) return DEFAULT_QUERIES;
  const perCat: Record<string, number> = { gpu: 3, cpu: 3, motherboard: 2, monitor: 2, prebuilt: 0 };
  const out: { category: Category; q: string }[] = [];
  for (const [cat, t] of Object.entries(targets.targets)) {
    const limit = perCat[cat] ?? 1;
    // Specific model names make good searches; generic words ("DDR5", "quiet") don't.
    const good = (t.prefer ?? []).filter((p) => /\d/.test(p) && p.trim().length >= 6).slice(0, limit);
    for (const q of good) out.push({ category: cat as Category, q: q.toLowerCase() });
  }
  const seen = new Set<string>();
  const uniq = out.filter((x) => !seen.has(x.q) && seen.add(x.q));
  return (uniq.length >= 4 ? uniq : [...uniq, ...DEFAULT_QUERIES]).slice(0, MAX_QUERIES);
}

function stockFrom(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/avail:\s*(out of stock|no stock|pre-?order|sold out|eta|call)/.test(t)) return false;
  if (/avail:\s*(in stock|yes|available|\d+)/.test(t)) return true;
  return null;
}

export function parseStaticIce(html: string, category: Category, query: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $('tr[valign="top"]').each((_, el) => {
    const tds = $(el).children("td");
    if (tds.length !== 2) return;
    const priceText = tds.eq(0).text().trim();
    if (!/^\$\d/.test(priceText)) return;
    const desc = tds.eq(1);
    const storeLink = desc.find("font a").first();
    const store = storeLink.text().trim();
    if (!store) return;
    // Title = text before the first <br> in the description cell
    const title = (desc.html() ?? "").split(/<br\s*\/?>/i)[0]!.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (!title) return;
    const meta = desc.find("font").first().text();
    const domain = meta.match(/\|\s*(www\.[a-z0-9.-]+)/i)?.[1];
    const states = meta.match(/\(([A-Z, ]+)\)/)?.[1] ?? "";
    const retailerId = matchRetailer(store, domain ? `https://${domain}` : storeLink.attr("href"));
    if (retailerId && SCRAPED_DIRECTLY.has(retailerId)) return;
    const cleanTitle = title.replace(/\s*\[Avail:[^\]]*\]\s*/i, "").replace(/\.\.\.$/, "").trim();
    out.push({
      externalId: createHash("md5").update(`${store}|${cleanTitle}`).digest("hex").slice(0, 20),
      title: cleanTitle,
      url: `${BASE}/cgi-bin/search.cgi?q=${encodeURIComponent(query)}`,
      category,
      priceCents: toCents(priceText.replace(/[^\d.]/g, "")),
      inStock: stockFrom(title),
      seller: { name: store, vic: /\bVIC\b/.test(states) },
    });
  });
  return out;
}

export const staticice: ScraperModule = {
  id: "staticice",
  name: "StaticICE",
  kind: "aggregator",
  async scrape({ fetch, log, searchQueries }) {
    const queries = (searchQueries?.length ? searchQueries : DEFAULT_QUERIES).slice(0, MAX_QUERIES);
    const byId = new Map<string, RawListing>();
    const failed = new Set<Category>();
    const touched = new Set<Category>();
    for (const { category, q } of queries) {
      touched.add(category);
      try {
        const html = await fetch.text(`${BASE}/cgi-bin/search.cgi?q=${encodeURIComponent(q)}&spos=1`);
        const items = parseStaticIce(html, category, q);
        for (const l of items) if (!byId.has(l.externalId)) byId.set(l.externalId, l);
        log.info(`"${q}": ${items.length} offers`);
      } catch (err) {
        if (err instanceof BlockedError) throw err;
        failed.add(category);
        log.warn(`"${q}" failed: ${(err as Error).message}`);
      }
    }
    return {
      listings: [...byId.values()],
      completedCategories: [...touched].filter((c) => !failed.has(c)),
      incompleteCategories: [...failed],
    };
  },
};
