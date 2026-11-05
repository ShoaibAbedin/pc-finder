# PC Finder

Personal Australian PC deal finder. Scrapes deals and retailer prices, keeps price history, and (in later phases) ranks deals against my build goals.

## Status
- [x] **Phase 1** — OzBargain computing feed + Mwave scraper → Supabase (products, price history, expiry, run log)
- [ ] Phase 2 — Website: deals list, categories, filters
- [ ] Phase 3 — Onboarding/settings, AI parsing & ranking
- [ ] Phase 4 — Scheduled GitHub Actions + "Refresh now"
- [ ] Phase 5 — Remaining retailers
- [ ] Phase 6 — Full build assembler

## Setup
1. Install Node.js LTS.
2. `npm install`
3. Copy `.env.example` → `.env.local` and fill in the Supabase values (never commit `.env.local`).
4. `npm run db:migrate` — creates tables.

## Commands
| Command | What it does |
|---|---|
| `npm run scrape` | Run all scrapers and save to Supabase |
| `npm run scrape:dry` | Scrape and print results, no DB writes |
| `npm run scrape -- --only=mwave --max-pages=1` | One source, quick test |
| `npm run db:check` | Row counts + recent runs |
| `npm test` | Unit tests (+ DB integration tests if keys are set) |

## How scraping works
- Each source is a plug-in in `scrapers/sources/`, registered in `scrapers/registry.ts`.
- All requests go through `PoliteFetcher` (`scrapers/core/fetcher.ts`): robots.txt checked, one request at a time per site with a 3–6 s delay (or the site's Crawl-delay), honest User-Agent.
- If a site returns 403/429 or a CAPTCHA/bot-challenge page, that source is **skipped and logged as `blocked`** in `scrape_runs` — no bypass attempts.
- `price_history` gets a row only when price or stock changes. Real discounts are measured against this history, not retailers' "was" prices.
- A product missing from 2 consecutive successful scrapes of its category is marked `expired`. Categories that failed mid-scrape are never expired.

### Adding a retailer
1. Create `scrapers/sources/<id>.ts` exporting a `ScraperModule` (see `mwave.ts`).
2. Add it to `scrapers/registry.ts`.
3. Ensure a `retailers` row with the same `id` exists (`supabase/migrations/002_seed_retailers.sql`).
4. Save a sample response in `tests/fixtures/` and add a parser test.

### Source notes (checked 5 Nov 2026)
| Source | Status |
|---|---|
| OzBargain | RSS allowed by robots.txt |
| Mwave | Shopify JSON (`/collections/*/products.json`) allowed |
| PCCaseGear | robots.txt allows, Crawl-delay 10 s |
| Scorptec | robots.txt allows most pages, Crawl-delay 30 s |
| Umart / MSY | robots.txt allows category pages |
| StaticICE | robots.txt allows search pages |
| Centre Com | AWS WAF CAPTCHA on all requests → will be skipped/logged |
