import * as cheerio from "cheerio";
import { BlockedError } from "../core/fetcher";
import { toCents } from "../core/price";
import type { Category, RawListing, ScraperModule } from "../core/types";

/**
 * Umart and MSY run on the same platform (same layout, same category URLs). Category pages are
 * server-rendered with schema.org microdata, 20 products per page, `?page=N` pagination
 * (allowed by robots.txt; `?category=`/`?id=` style URLs are disallowed and never used).
 */
const PATHS: { category: Category; paths: string[] }[] = [
  { category: "gpu", paths: ["pc-parts/computer-parts/graphics-cards-gpu-610"] },
  { category: "cpu", paths: ["pc-parts/computer-parts/cpu-processors-611"] },
  { category: "motherboard", paths: ["pc-parts/computer-parts/motherboards-104"] },
  { category: "ram", paths: ["pc-parts/computer-parts/memory-ram-108"] },
  { category: "storage", paths: ["pc-parts/storage-devices/ssd-hard-drives-580", "pc-parts/storage-devices/hard-drives-hdd/desktop-hard-drives-656"] },
  { category: "psu", paths: ["pc-parts/computer-parts/power-supply-psu-140"] },
  { category: "case", paths: ["pc-parts/computer-parts/cases-139"] },
  { category: "cooling", paths: ["pc-parts/computer-parts/cooling-191", "pc-parts/computer-parts/water-cooling-682"] },
  { category: "monitor", paths: ["pc-parts/peripherals/monitors-142"] },
  { category: "peripheral", paths: ["pc-parts/peripherals/keyboards-40", "pc-parts/peripherals/mouse-mouse-pads-24", "pc-parts/peripherals/headphones-147"] },
  { category: "software", paths: ["pc-parts/software-services/operating-systems-573"] },
];
const MAX_PAGES_PER_PATH = 35; // safety stop (20 items/page)

function stockFrom(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/out of stock|sold out|pre-?order|call|discontinued|unavailable|eta/.test(t)) return false;
  if (/in stock|low stock|limited|available|ships/.test(t)) return true;
  return null;
}

export function parseUmartListing(html: string, category: Category, base: string): { items: RawListing[]; lastPage: number } {
  const $ = cheerio.load(html);
  const items: RawListing[] = [];
  $(".goods-item").each((_, el) => {
    const g = $(el);
    const a = g.find(".goods_name a[href]").first();
    const href = a.attr("href") ?? "";
    const id = href.match(/-(\d+)$/)?.[1];
    const title = (g.find('.goods_name [itemprop="name"]').first().text() || a.attr("title") || "").trim().replace(/\s+/g, " ");
    if (!id || !title) return;
    const priceEl = g.find('[itemprop="price"]').first();
    items.push({
      externalId: id,
      sku: title.match(/\(([A-Z0-9][A-Z0-9._/-]{3,})\)\s*$/i)?.[1],
      title,
      url: href.startsWith("http") ? href : `${base}${href}`,
      category,
      priceCents: toCents(priceEl.attr("content") ?? priceEl.text()),
      inStock: stockFrom(g.find(".goods_stock").first().text()),
      brand: g.find('[itemprop="brand"]').first().text().trim() || title.split(" ")[0],
      imageUrl: g.find(".goods_img img").first().attr("src") || undefined,
    });
  });
  const pages = $('a[href*="page="]')
    .map((_, e) => Number(/[?&]page=(\d+)/.exec($(e).attr("href") ?? "")?.[1] ?? 0))
    .get();
  return { items, lastPage: Math.max(1, ...pages) };
}

function makeModule(id: string, name: string, base: string): ScraperModule {
  return {
    id,
    name,
    kind: "retailer",
    async scrape({ fetch, log, maxPages }) {
      const byId = new Map<string, RawListing>();
      const completed: Category[] = [];
      const incomplete: Category[] = [];
      const cap = Math.min(maxPages ?? MAX_PAGES_PER_PATH, MAX_PAGES_PER_PATH);
      for (const { category, paths } of PATHS) {
        let ok = true;
        for (const path of paths) {
          try {
            let last = 1;
            for (let page = 1; page <= Math.min(last, cap); page++) {
              const { items, lastPage } = parseUmartListing(await fetch.text(`${base}/${path}${page > 1 ? `?page=${page}` : ""}`), category, base);
              if (page === 1) last = lastPage;
              if (!items.length) {
                if (page === 1) throw new Error("no products found (page layout changed?)");
                break;
              }
              for (const l of items) if (!byId.has(l.externalId)) byId.set(l.externalId, l);
            }
            if (last > cap) {
              ok = false; // didn't see every page → don't expire anything in this category
              log.warn(`${path}: ${last} pages, capped at ${cap}`);
            }
            log.info(`${category}/${path.split("/").pop()}: ${Math.min(last, cap)} pages`);
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
}

export const umart = makeModule("umart", "Umart", "https://www.umart.com.au");
export const msy = makeModule("msy", "MSY", "https://www.msy.com.au");
