import robotsParser from "robots-parser";
import { scraperConfig } from "../config";
import { silentLogger, type Logger } from "./logger";

/** The site is refusing us (403/429/CAPTCHA/bot challenge). Stop scraping that source; never try to bypass. */
export class BlockedError extends Error {
  constructor(
    public readonly url: string,
    public readonly reason: string,
  ) {
    super(`Blocked at ${url}: ${reason}`);
    this.name = "BlockedError";
  }
}

/** robots.txt disallows this URL for our bot. */
export class RobotsDisallowedError extends Error {
  constructor(public readonly url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

export class HttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface FetcherOptions {
  userAgent?: string;
  robotsToken?: string;
  minDelayMs?: number;
  maxDelayMs?: number;
  maxCrawlDelayMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  log?: Logger;
}

interface Robots {
  isAllowed(url: string, ua?: string): boolean | undefined;
  getCrawlDelay(ua?: string): number | undefined;
}

interface HostState {
  robots?: Promise<Robots | "blocked">;
  lastRequestAt?: number;
  queue: Promise<unknown>;
}

const CHALLENGE_MARKERS = [
  /<title>\s*just a moment/i, // Cloudflare
  /cf-chl-|challenge-platform/i, // Cloudflare
  /awswaf|aws-waf-token/i, // AWS WAF
  /<title>\s*human verification/i,
  /captcha-container|g-recaptcha|h-captcha|hcaptcha\.com/i,
  /<title>\s*access denied/i, // Akamai
];

export function looksLikeChallenge(body: string): boolean {
  // Only inspect the head of the document; real product pages may mention "captcha" deep in scripts.
  const head = body.slice(0, 20_000);
  return CHALLENGE_MARKERS.some((re) => re.test(head));
}

/**
 * Polite HTTP client shared by all scrapers:
 *  - checks robots.txt before every request (cached per host per run)
 *  - one request at a time per host, with a random delay (or the site's Crawl-delay if larger)
 *  - detects blocking (403/429/challenge pages) and throws BlockedError — no bypass attempts
 */
export class PoliteFetcher {
  private hosts = new Map<string, HostState>();
  private o: Required<Omit<FetcherOptions, "log">> & { log: Logger };
  public requestCount = 0;

  constructor(opts: FetcherOptions = {}) {
    this.o = {
      userAgent: opts.userAgent ?? scraperConfig.userAgent,
      robotsToken: opts.robotsToken ?? scraperConfig.robotsToken,
      minDelayMs: opts.minDelayMs ?? scraperConfig.minDelayMs,
      maxDelayMs: opts.maxDelayMs ?? scraperConfig.maxDelayMs,
      maxCrawlDelayMs: opts.maxCrawlDelayMs ?? scraperConfig.maxCrawlDelayMs,
      maxRetries: opts.maxRetries ?? scraperConfig.maxRetries,
      timeoutMs: opts.timeoutMs ?? scraperConfig.requestTimeoutMs,
      fetchImpl: opts.fetchImpl ?? ((u, i) => fetch(u, i)),
      sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      now: opts.now ?? Date.now,
      random: opts.random ?? Math.random,
      log: opts.log ?? silentLogger,
    };
  }

  async text(url: string): Promise<string> {
    return (await this.request(url)).body;
  }

  async json<T = unknown>(url: string): Promise<T> {
    const { body } = await this.request(url);
    try {
      return JSON.parse(body) as T;
    } catch {
      // A non-JSON reply where JSON was expected is usually a challenge/interstitial page.
      if (looksLikeChallenge(body)) throw new BlockedError(url, "bot challenge page");
      throw new Error(`Invalid JSON from ${url}`);
    }
  }

  private host(url: string): HostState {
    const origin = new URL(url).origin;
    let h = this.hosts.get(origin);
    if (!h) {
      h = { queue: Promise.resolve() };
      this.hosts.set(origin, h);
    }
    return h;
  }

  /** Serialises requests per host so delays are honoured even if callers run in parallel. */
  private request(url: string): Promise<{ status: number; body: string }> {
    const h = this.host(url);
    const run = h.queue.then(() => this.doRequest(url, h));
    h.queue = run.catch(() => {});
    return run;
  }

  private async doRequest(url: string, h: HostState): Promise<{ status: number; body: string }> {
    const robots = await this.getRobots(url, h);
    if (robots === "blocked") throw new BlockedError(url, "robots.txt request was blocked/challenged");
    if (robots.isAllowed(url, this.o.robotsToken) === false) throw new RobotsDisallowedError(url);

    const crawlDelaySec = robots.getCrawlDelay(this.o.robotsToken);
    const crawlDelayMs = crawlDelaySec ? crawlDelaySec * 1000 : 0;
    if (crawlDelayMs > this.o.maxCrawlDelayMs) {
      throw new Error(`Crawl-delay ${crawlDelaySec}s for ${new URL(url).host} exceeds our max; skipping`);
    }

    let attempt = 0;
    for (;;) {
      await this.waitTurn(h, crawlDelayMs);
      try {
        const res = await this.rawFetch(url);
        const body = await res.text();
        if (res.status === 403 || res.status === 429 || res.status === 451) {
          throw new BlockedError(url, `HTTP ${res.status}`);
        }
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("html") && looksLikeChallenge(body)) {
          throw new BlockedError(url, "bot challenge page");
        }
        if (res.status >= 500) throw new HttpError(url, res.status);
        if (res.status >= 400) {
          // 4xx other than the above: not retryable, not "blocked"
          const err = new HttpError(url, res.status);
          (err as HttpError & { noRetry: true }).noRetry = true;
          throw err;
        }
        return { status: res.status, body };
      } catch (err) {
        if (err instanceof BlockedError) throw err;
        if ((err as { noRetry?: boolean }).noRetry) throw err;
        if (attempt >= this.o.maxRetries) throw err;
        attempt++;
        const backoff = 5000 * attempt;
        this.o.log.warn(`${(err as Error).message} — retry ${attempt}/${this.o.maxRetries} in ${backoff / 1000}s`);
        await this.o.sleep(backoff);
      }
    }
  }

  private async waitTurn(h: HostState, crawlDelayMs: number) {
    const { minDelayMs, maxDelayMs } = this.o;
    const delay = Math.max(crawlDelayMs, minDelayMs + this.o.random() * (maxDelayMs - minDelayMs));
    if (h.lastRequestAt !== undefined) {
      const wait = h.lastRequestAt + delay - this.o.now();
      if (wait > 0) await this.o.sleep(wait);
    }
    h.lastRequestAt = this.o.now();
  }

  private async rawFetch(url: string): Promise<Response> {
    this.requestCount++;
    return this.o.fetchImpl(url, {
      headers: { "User-Agent": this.o.userAgent, Accept: "*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(this.o.timeoutMs),
    });
  }

  private getRobots(url: string, h: HostState): Promise<Robots | "blocked"> {
    if (!h.robots) {
      const robotsUrl = new URL("/robots.txt", url).toString();
      h.robots = (async () => {
        await this.waitTurn(h, 0);
        let res: Response;
        try {
          res = await this.rawFetch(robotsUrl);
        } catch (err) {
          // Can't reach robots.txt → be conservative and treat the site as unavailable this run.
          throw new Error(`Could not fetch ${robotsUrl}: ${(err as Error).message}`);
        }
        const body = await res.text();
        if (res.status === 403 || res.status === 429 || looksLikeChallenge(body)) return "blocked";
        if (res.status >= 400 && res.status < 500) return robotsParser(robotsUrl, ""); // no robots.txt = allow all
        if (res.status >= 500) throw new Error(`robots.txt returned HTTP ${res.status}`);
        return robotsParser(robotsUrl, body);
      })();
      h.robots.catch(() => {
        h.robots = undefined; // allow a retry on the next request
      });
    }
    return h.robots;
  }
}
