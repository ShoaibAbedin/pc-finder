import { describe, expect, it } from "vitest";
import { BlockedError, HttpError, PoliteFetcher, RobotsDisallowedError } from "../scrapers/core/fetcher";

type Route = { status?: number; body?: string; type?: string };

/** Fake clock + fake fetch so tests run instantly and we can inspect timing. */
function setup(routes: Record<string, Route | Route[]>, opts: { min?: number; max?: number } = {}) {
  let clock = 0;
  const calls: { url: string; at: number; ua: string }[] = [];
  const counters: Record<string, number> = {};
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, at: clock, ua: (init?.headers as Record<string, string>)["User-Agent"]! });
    const r = routes[url];
    const route = Array.isArray(r) ? r[Math.min((counters[url] = (counters[url] ?? -1) + 1), r.length - 1)]! : r;
    if (!route) return new Response("not found", { status: 404 });
    return new Response(route.body ?? "", {
      status: route.status ?? 200,
      headers: { "content-type": route.type ?? "text/html" },
    });
  };
  const f = new PoliteFetcher({
    fetchImpl,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    random: () => 0.5,
    minDelayMs: opts.min ?? 1000,
    maxDelayMs: opts.max ?? 3000,
    userAgent: "pc-finder-bot/test",
    robotsToken: "pc-finder-bot",
  });
  return { f, calls };
}

const robots = (body: string) => ({ "https://shop.test/robots.txt": { body, type: "text/plain" } });

describe("PoliteFetcher", () => {
  it("skips URLs disallowed by robots.txt without requesting them", async () => {
    const { f, calls } = setup({ ...robots("User-agent: *\nDisallow: /private") });
    await expect(f.text("https://shop.test/private/page")).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(calls.map((c) => c.url)).toEqual(["https://shop.test/robots.txt"]);
  });

  it("fetches robots.txt once per host and sends our User-Agent", async () => {
    const { f, calls } = setup({
      ...robots("User-agent: *\nAllow: /"),
      "https://shop.test/a": { body: "A" },
      "https://shop.test/b": { body: "B" },
    });
    expect(await f.text("https://shop.test/a")).toBe("A");
    expect(await f.text("https://shop.test/b")).toBe("B");
    expect(calls.filter((c) => c.url.endsWith("robots.txt"))).toHaveLength(1);
    expect(calls.every((c) => c.ua === "pc-finder-bot/test")).toBe(true);
  });

  it("waits between requests to the same host (random delay, here 2000ms)", async () => {
    const { f, calls } = setup({
      ...robots(""),
      "https://shop.test/a": { body: "A" },
      "https://shop.test/b": { body: "B" },
    });
    await Promise.all([f.text("https://shop.test/a"), f.text("https://shop.test/b")]); // even in parallel
    const at = calls.map((c) => c.at);
    expect(at[1]! - at[0]!).toBeGreaterThanOrEqual(2000);
    expect(at[2]! - at[1]!).toBeGreaterThanOrEqual(2000);
  });

  it("honours a larger Crawl-delay from robots.txt", async () => {
    const { f, calls } = setup({
      ...robots("User-agent: *\nCrawl-delay: 10"),
      "https://shop.test/a": { body: "A" },
      "https://shop.test/b": { body: "B" },
    });
    await f.text("https://shop.test/a");
    await f.text("https://shop.test/b");
    expect(calls[2]!.at - calls[1]!.at).toBeGreaterThanOrEqual(10_000);
  });

  it("treats 403 and 429 as blocked, with no retries", async () => {
    const { f, calls } = setup({ ...robots(""), "https://shop.test/x": { status: 403 }, "https://shop.test/y": { status: 429 } });
    await expect(f.text("https://shop.test/x")).rejects.toBeInstanceOf(BlockedError);
    await expect(f.text("https://shop.test/y")).rejects.toBeInstanceOf(BlockedError);
    expect(calls.filter((c) => c.url === "https://shop.test/x")).toHaveLength(1);
  });

  it("detects CAPTCHA / challenge pages, including on robots.txt", async () => {
    const challenge = "<html><head><title>Human Verification</title><script>window.awsWafCookieDomainList=[]</script>";
    const { f } = setup({ "https://shop.test/robots.txt": { status: 405, body: challenge } });
    await expect(f.text("https://shop.test/page")).rejects.toBeInstanceOf(BlockedError);

    const s2 = setup({ ...robots(""), "https://shop.test/p": { body: "<title>Just a moment...</title>" } });
    await expect(s2.f.text("https://shop.test/p")).rejects.toBeInstanceOf(BlockedError);
  });

  it("retries 5xx then succeeds", async () => {
    const { f, calls } = setup({ ...robots(""), "https://shop.test/z": [{ status: 503 }, { body: "ok" }] });
    expect(await f.text("https://shop.test/z")).toBe("ok");
    expect(calls.filter((c) => c.url.endsWith("/z"))).toHaveLength(2);
  });

  it("does not retry a plain 404", async () => {
    const { f, calls } = setup({ ...robots("") });
    await expect(f.text("https://shop.test/missing")).rejects.toBeInstanceOf(HttpError);
    expect(calls.filter((c) => c.url.endsWith("/missing"))).toHaveLength(1);
  });

  it("allows everything when robots.txt is 404", async () => {
    const { f } = setup({ "https://shop.test/a": { body: "A" } });
    expect(await f.text("https://shop.test/a")).toBe("A");
  });
});
