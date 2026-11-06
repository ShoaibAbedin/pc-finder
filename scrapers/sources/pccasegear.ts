import * as cheerio from "cheerio";
import { BlockedError } from "../core/fetcher";
import { toCents } from "../core/price";
import type { Category, RawListing, ScraperModule } from "../core/types";

const BASE = "https://www.pccasegear.com";

/**
 * PCCG leaf category pages list every product on one page (no pagination), server-rendered.
 * robots.txt asks for Crawl-delay: 10, which the shared fetcher honours (~30 pages ≈ 5 min).
 * Leaves chosen to cover each category with as few pages as possible ("all models" pages where they exist).
 */
export const PCCG_CATEGORIES: { category: Category; paths: string[] }[] = [
  { category: "gpu", paths: ["193_876/graphics-cards/nvidia-graphics-cards", "193_877/graphics-cards/amd-graphics-cards", "193_2225/graphics-cards/intel-graphics-cards"] },
  {
    category: "cpu",
    paths: ["187_2283/cpus/amd-am5-9000", "187_2217/cpus/amd-am5-7000", "187_2269/cpus/amd-am5-8000", "187_2138/cpus/amd-am4-5000", "187_2290/cpus/intel-1851-core-ultra", "187_2260/cpus/intel-1700-14th-gen", "187_2180/cpus/intel-1700-12th-gen"],
  },
  {
    category: "motherboard",
    paths: ["138_2282/motherboards/amd-socket-am5-zen5", "138_2220/motherboards/amd-socket-am5-zen4", "138_2023/motherboards/amd-socket-am4-zen3", "138_2291/motherboards/intel-1851-15th-gen", "138_2221/motherboards/intel-1700-13th-14th-gen"],
  },
  { category: "ram", paths: ["186_2181/memory/all-ddr5-memory", "186_1782/memory/all-ddr4-memory"] },
  { category: "storage", paths: ["210_902/hard-drives-ssds/solid-state-drives-ssd", "210_344/hard-drives-ssds/3-5-hard-drives"] },
  { category: "psu", paths: ["15_535/power-supplies/all-models"] },
  { category: "case", paths: ["25_547/cases/all-models"] },
  { category: "cooling", paths: ["207_23/cooling/cpu-cooling", "207_160/cooling/water-cooling"] },
  { category: "prebuilt", paths: ["1411_1917/pccg-gaming-pcs/ready-to-ship-gaming-pc", "1411_1918/pccg-gaming-pcs/customisable-gaming-pc"] },
  { category: "monitor", paths: ["558_1212/monitors/23-26-monitors", "558_1213/monitors/27-32-monitors", "558_2005/monitors/33-55-monitors"] },
  { category: "peripheral", paths: ["113_1276/keyboards/mechanical-keyboards", "113_2045/keyboards/wireless-keyboards", "258_698/mice-mouse-pads/all-models", "116_2018/headphones/gaming-headsets"] },
  { category: "software", paths: ["375_974/software/microsoft-windows"] },
];

function stockFrom(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/sold out|out of stock|discontinued|unavailable/.test(t)) return false;
  if (/in stock|stock at supplier|low stock|available/.test(t)) return true;
  if (/pre-?order|coming soon|backorder/.test(t)) return false;
  return null;
}

export function parsePccgListing(html: string, category: Category): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $("ul.media-list > li.media").each((_, el) => {
    const li = $(el);
    const link = li.find("h5.media-heading a[href]").first();
    const href = link.attr("href") ?? "";
    const id = href.match(/\/products\/(\d+)/)?.[1];
    const title = link.text().trim().replace(/\s+/g, " ");
    if (!id || !title) return;
    // Desktop and mobile blocks both carry the price; take the first.
    const price = toCents(li.find(".product-price").first().text().trim());
    const status = li.find(".product-status button.tool-tip-wrapper").first().text() || li.find(".product-status").first().text();
    out.push({
      externalId: id,
      sku: li.find('input[name="products_id"]').first().attr("value") ?? id,
      title,
      url: href.startsWith("http") ? href : `${BASE}${href}`,
      category,
      priceCents: price,
      inStock: stockFrom(status),
      brand: title.split(" ")[0],
    });
  });
  return out;
}

export const pccasegear: ScraperModule = {
  id: "pccasegear",
  name: "PC Case Gear",
  kind: "retailer",
  async scrape({ fetch, log, maxPages }) {
    const byId = new Map<string, RawListing>();
    const completed: Category[] = [];
    const incomplete: Category[] = [];
    for (const { category, paths } of PCCG_CATEGORIES) {
      let ok = true;
      const list = maxPages ? paths.slice(0, maxPages) : paths;
      if (list.length < paths.length) ok = false; // capped test run — don't expire anything
      for (const path of list) {
        try {
          const html = await fetch.text(`${BASE}/category/${path}`);
          const items = parsePccgListing(html, category);
          if (!items.length) throw new Error("no products found (page layout changed?)");
          for (const l of items) if (!byId.has(l.externalId)) byId.set(l.externalId, l);
          log.info(`${category}/${path.split("/").pop()}: ${items.length}`);
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
