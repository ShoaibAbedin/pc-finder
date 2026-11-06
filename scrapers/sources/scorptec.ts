import * as cheerio from "cheerio";
import { BlockedError } from "../core/fetcher";
import { toCents } from "../core/price";
import type { Category, RawListing, ScraperModule } from "../core/types";

const BASE = "https://www.scorptec.com.au";

/**
 * Scorptec category pages are server-rendered and list everything on one page.
 * robots.txt sets Crawl-delay: 30 → ~24 pages ≈ 12 min per run (runs in parallel with other sites).
 */
export const SCORPTEC_CATEGORIES: { category: Category; paths: string[] }[] = [
  { category: "gpu", paths: ["graphics-cards/nvidia", "graphics-cards/amd", "graphics-cards/intel"] },
  { category: "cpu", paths: ["cpu/amd-socket-am5", "cpu/amd-socket-am4", "cpu/intel-socket-1851", "cpu/intel-socket-1700"] },
  {
    category: "motherboard",
    paths: ["motherboards/amd-socket-am5", "motherboards/amd-socket-am4", "motherboards/intel-socket-1851", "motherboards/intel-socket-1700"],
  },
  { category: "ram", paths: ["memory/ddr5-desktop-memory", "memory/ddr4-desktop-memory"] },
  { category: "storage", paths: ["hard-drives-and-ssds/solid-state-drives-ssd"] },
  { category: "psu", paths: ["power-supplies/all-power-supplies"] },
  { category: "case", paths: ["cases/all-cases"] },
  { category: "cooling", paths: ["cooling/cpu-coolers", "cooling/water-cooling"] },
  { category: "prebuilt", paths: ["branded-systems/desktop"] },
  { category: "monitor", paths: ["monitors/all-monitors"] },
  { category: "peripheral", paths: ["keyboards/mechanical-keyboards", "mouse-and-mouse-pads/gaming-mice", "headphones/gaming-headphones"] },
  { category: "software", paths: ["software/windows"] },
];

function stockFrom(status: string): boolean | null {
  const s = status.toLowerCase();
  if (/sold out|out of stock|discontinued|unavailable|pre-?order|coming soon|eta/.test(s)) return false;
  if (/in stock|limited stock|low stock|available|at supplier/.test(s)) return true;
  return null;
}

/**
 * Every product is in the HTML as `[id^=product-list-detail-]` with data attributes (data-sku, data-price,
 * data-instock, data-model). Only the first 30 are fully rendered; the rest have empty links/images that the
 * browser fills in later, so we read the data attributes and rebuild the product URL
 * (`/product/<listing path>/<sku>-<model>`, same pattern as the rendered ones).
 */
export function parseScorptecListing(html: string, category: Category, listingPath = ""): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $('[id^="product-list-detail-"]').each((_, el) => {
    const box = $(el);
    const id = box.attr("data-sku") || box.attr("id")?.replace("product-list-detail-", "");
    const link = box.find(".detail-product-title a").first();
    const title = (link.attr("title") || link.text()).trim().replace(/\s+/g, " ");
    if (!id || !/^\d+$/.test(id) || !title) return;

    const model = box.find(".detail-product-warranty span[title]").last().attr("title") || box.attr("data-model") || "";
    const href = link.attr("href") ?? "";
    const url = href
      ? href.startsWith("http")
        ? href
        : `${BASE}${href}`
      : `${BASE}/product/${listingPath}/${id}-${model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

    const price = toCents(box.attr("data-price") ?? "") ?? toCents(box.find(".detail-product-price").first().text().trim());
    const was = toCents(box.find(".detail-product-before-price").first().text().trim());
    const statusEl = box.find(".status-box").first();
    const status = statusEl.attr("data-status") ?? statusEl.text();
    const inStock = status ? stockFrom(status) : box.attr("data-instock") === "1" ? true : box.attr("data-instock") === "0" ? false : null;
    const img = box.find(".detail-image-wrapper img").first();

    out.push({
      externalId: id,
      sku: model || undefined,
      title,
      url,
      category,
      priceCents: price,
      retailerWasPriceCents: was && price && was > price ? was : null,
      inStock,
      brand: title.split(" ")[0],
      imageUrl: img.attr("data-src") || img.attr("src") || undefined,
    });
  });
  return out;
}

export const scorptec: ScraperModule = {
  id: "scorptec",
  name: "Scorptec",
  kind: "retailer",
  async scrape({ fetch, log, maxPages }) {
    const byId = new Map<string, RawListing>();
    const completed: Category[] = [];
    const incomplete: Category[] = [];
    for (const { category, paths } of SCORPTEC_CATEGORIES) {
      let ok = true;
      const list = maxPages ? paths.slice(0, maxPages) : paths;
      if (list.length < paths.length) ok = false;
      for (const path of list) {
        try {
          const items = parseScorptecListing(await fetch.text(`${BASE}/product/${path}`), category, path);
          if (!items.length) throw new Error("no products found (page layout changed?)");
          for (const l of items) if (!byId.has(l.externalId)) byId.set(l.externalId, l);
          log.info(`${category}/${path}: ${items.length}`);
        } catch (err) {
          if (err instanceof BlockedError) throw err;
          ok = false;
          log.warn(`${path} failed: ${(err as Error).message}`);
        }
      }
      (ok ? completed : incomplete).push(category);
    }
    return { listings: [...byId.values()], completedCategories: completed, incompleteCategories: incomplete };
  },
};
