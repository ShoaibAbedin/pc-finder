/** Central scraper settings. Tweak here rather than in individual scrapers. */
export const scraperConfig = {
  /** Honest bot identity. The first token is what robots.txt rules are matched against. */
  userAgent: "pc-finder-bot/0.1 (personal non-commercial price tracker)",
  robotsToken: "pc-finder-bot",

  /** Polite delay between requests to the same host (random within range). robots.txt Crawl-delay overrides if larger. */
  minDelayMs: 3000,
  maxDelayMs: 6000,

  /** Never wait longer than this per request, even if a site asks for a bigger crawl-delay (we skip pages instead). */
  maxCrawlDelayMs: 60_000,

  requestTimeoutMs: 30_000,
  /** Retries for network errors / 5xx (never for 403/429 — those mean "blocked"). */
  maxRetries: 2,

  /** A product is marked expired after being missing from this many consecutive successful runs. */
  expireAfterMissedRuns: 2,

  /** OzBargain posts with no expiry date are treated as expired after this many days. */
  ozbargainStaleDays: 14,
};
