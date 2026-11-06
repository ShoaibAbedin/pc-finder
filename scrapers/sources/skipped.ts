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

export const centrecom = skipped(
  "centrecom",
  "Centre Com",
  "Skipped: Centre Com shows a CAPTCHA (AWS WAF) to automated requests. Its prices still arrive via StaticICE/OzBargain.",
  "https://www.centrecom.com.au/",
);

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
