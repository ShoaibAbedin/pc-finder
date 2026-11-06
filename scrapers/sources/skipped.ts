import { RobotsDisallowedError } from "../core/fetcher";
import type { ScraperModule } from "../core/types";

/**
 * Retailers we deliberately don't scrape. They still appear in the Update log (status "blocked")
 * so it's clear why — and their deals still reach the site via OzBargain / StaticICE.
 */
function skipped(id: string, name: string, reason: string, url: string): ScraperModule {
  return {
    id,
    name,
    kind: "retailer",
    async scrape() {
      const err = new RobotsDisallowedError(url);
      err.message = reason;
      throw err;
    },
  };
}

/** Centre Com is probed for real each run (one request) — if its CAPTCHA ever goes away we'll see it. */
export const centrecom: ScraperModule = {
  id: "centrecom",
  name: "Centre Com",
  kind: "retailer",
  async scrape({ fetch }) {
    await fetch.text("https://www.centrecom.com.au/graphics-cards"); // throws BlockedError on the CAPTCHA
    throw new Error("Centre Com is reachable again — a scraper can now be built for it");
  },
};

export const jbhifi = skipped(
  "jbhifi",
  "JB Hi-Fi",
  "Skipped: JB Hi-Fi loads product listings from a search service that its robots.txt disallows (/search, ?q=). Deals still arrive via OzBargain/StaticICE.",
  "https://www.jbhifi.com.au/search",
);

export const amazonAu = skipped(
  "amazon-au",
  "Amazon AU",
  "Skipped: Amazon AU blocks automated requests (HTTP 503 to bots). Deals still arrive via OzBargain.",
  "https://www.amazon.com.au/s",
);
