import { BlockedError } from "../core/fetcher";
import { toCents } from "../core/price";
import type { Category, RawListing, ScraperModule } from "../core/types";

const BASE = "https://www.mwave.com.au";
const PAGE_SIZE = 250; // Shopify max
const MAX_PAGES_PER_COLLECTION = 12; // safety stop

/**
 * Mwave is a Shopify store, so it exposes public JSON at /collections/<handle>/products.json
 * (allowed by its robots.txt). Collections chosen to match our categories without too much overlap.
 * A product in several collections keeps the category of the first one listed here.
 */
export const MWAVE_COLLECTIONS: { category: Category; handles: string[] }[] = [
  { category: "gpu", handles: ["graphics-cards"] },
  { category: "cpu", handles: ["cpu-processors"] },
  { category: "motherboard", handles: ["motherboards"] },
  { category: "ram", handles: ["memory"] },
  { category: "storage", handles: ["internal-solid-state-drives-ssd", "storage-internal-hard-drives"] },
  { category: "psu", handles: ["power-supplies"] },
  { category: "case", handles: ["computer-cases"] },
  { category: "cooling", handles: ["cpu-coolers-air", "all-in-one-water-cooling", "case-fans"] },
  { category: "prebuilt", handles: ["all-desktop-pcs-computers"] },
  { category: "monitor", handles: ["monitors"] },
  { category: "peripheral", handles: ["keyboards", "gaming-mouse-mice", "headsets"] },
  { category: "software", handles: ["windows-11"] },
];

interface ShopifyVariant {
  id: number;
  title: string;
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  available: boolean;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  images?: { src: string }[];
  variants: ShopifyVariant[];
}

export function parseShopifyProducts(json: { products?: ShopifyProduct[] }, category: Category): RawListing[] {
  const out: RawListing[] = [];
  for (const p of json.products ?? []) {
    const multi = p.variants.length > 1;
    for (const v of p.variants) {
      const price = toCents(v.price);
      const was = toCents(v.compare_at_price);
      out.push({
        externalId: String(multi ? v.id : p.id),
        sku: v.sku || undefined,
        title: multi && v.title !== "Default Title" ? `${p.title} — ${v.title}` : p.title,
        url: `${BASE}/products/${p.handle}${multi ? `?variant=${v.id}` : ""}`,
        category,
        priceCents: price,
        retailerWasPriceCents: was && price && was > price ? was : null,
        inStock: v.available,
        brand: p.vendor || undefined,
        imageUrl: p.images?.[0]?.src,
      });
    }
  }
  return out;
}

export const mwave: ScraperModule = {
  id: "mwave",
  name: "Mwave",
  kind: "retailer",
  async scrape({ fetch, log, maxPages }) {
    const byId = new Map<string, RawListing>();
    const completed: Category[] = [];
    const incomplete: Category[] = [];
    const pageCap = Math.min(maxPages ?? MAX_PAGES_PER_COLLECTION, MAX_PAGES_PER_COLLECTION);

    for (const { category, handles } of MWAVE_COLLECTIONS) {
      let ok = true;
      for (const handle of handles) {
        try {
          for (let page = 1; page <= pageCap; page++) {
            const url = `${BASE}/collections/${handle}/products.json?limit=${PAGE_SIZE}&page=${page}`;
            const json = await fetch.json<{ products?: ShopifyProduct[] }>(url);
            const listings = parseShopifyProducts(json, category);
            for (const l of listings) if (!byId.has(l.externalId)) byId.set(l.externalId, l);
            log.info(`${category}/${handle} p${page}: ${listings.length}`);
            if ((json.products?.length ?? 0) < PAGE_SIZE) break;
            if (page === pageCap) {
              // Stopped early (cap reached) → we didn't see everything, so don't expire anything here.
              ok = false;
              log.warn(`${handle}: page cap ${pageCap} reached; category marked incomplete`);
            }
          }
        } catch (err) {
          if (err instanceof BlockedError) throw err; // stop the whole source
          ok = false;
          log.warn(`${handle} failed: ${(err as Error).message}`);
        }
      }
      (ok ? completed : incomplete).push(category);
    }

    return { listings: [...byId.values()], completedCategories: completed, incompleteCategories: incomplete };
  },
};
