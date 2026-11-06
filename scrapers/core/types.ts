import type { PoliteFetcher } from "./fetcher";
import type { Logger } from "./logger";

export const CATEGORIES = [
  "gpu",
  "cpu",
  "motherboard",
  "ram",
  "storage",
  "psu",
  "case",
  "cooling",
  "prebuilt",
  "monitor",
  "peripheral",
  "software",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** One product listing as scraped from a retailer. Prices are integer cents (AUD). */
export interface RawListing {
  externalId: string; // stable ID at the retailer (variant ID, SKU, etc.)
  sku?: string;
  title: string;
  url: string;
  category: Category;
  priceCents: number | null;
  /** Retailer's own "was" price. Stored for reference only — never used for discount detection. */
  retailerWasPriceCents?: number | null;
  inStock: boolean | null; // null = unknown
  brand?: string;
  imageUrl?: string;
  /** For aggregator listings: the actual store selling it. */
  seller?: { name: string; vic: boolean };
}

/** One OzBargain deal post. */
export interface OzDeal {
  nodeId: string;
  title: string;
  link: string; // ozbargain.com.au/node/...
  dealUrl?: string; // the store's product URL
  store?: string; // text after "@" in title
  retailerId?: string; // matched to our retailers table, if known
  priceCents: number | null; // parsed from the title (scraped, not AI)
  category: Category;
  tags: string[];
  votesPos: number;
  votesNeg: number;
  commentCount: number;
  postedAt?: string; // ISO
  expiresAt?: string; // ISO
  expired: boolean;
  imageUrl?: string;
}

export interface ScrapeOutput {
  listings?: RawListing[];
  deals?: OzDeal[];
  /** Categories fully scraped this run. Only these are eligible for "missing → expired" logic. */
  completedCategories?: Category[];
  /** Categories that failed part-way. Their products are NOT expired this run. */
  incompleteCategories?: Category[];
}

export interface ScrapeContext {
  fetch: PoliteFetcher;
  log: Logger;
  /** Optional cap on listing pages per category (for quick test runs). */
  maxPages?: number;
  /** Search terms for query-based sources (StaticICE), derived from the AI build targets. */
  searchQueries?: { category: Category; q: string }[];
}

/**
 * A scraper plug-in. To add a retailer: create a file in scrapers/sources/ exporting one of these,
 * then add it to scrapers/registry.ts.
 */
export interface ScraperModule {
  id: string; // must match retailers.id in the database
  name: string;
  kind: "retailer" | "aggregator";
  /** Per-site delay between requests (defaults to scraperConfig). A robots.txt Crawl-delay always wins if larger. */
  politeness?: { minDelayMs: number; maxDelayMs: number };
  scrape(ctx: ScrapeContext): Promise<ScrapeOutput>;
}
