import { describe, expect, it } from "vitest";
import { sendPush } from "../lib/alerts/notify";
import { buildDropAlert, topPickAlerts, type TopPickSnapshot } from "../lib/alerts/run";
import type { BuildResult } from "../lib/build/assembler";

const result = (total: number): BuildResult => ({
  budgetCents: 200000,
  builds: [
    {
      label: "best",
      limitCents: 200000,
      totalCents: total,
      checks: [],
      owned: [],
      parts: [{ category: "gpu", key: "p:1", title: "RX 9060 XT 16GB", priceCents: 74900, retailer: "Mwave", url: "https://x", pickup: false, imageUrl: null }],
    },
  ],
  extras: [],
  extrasTotalCents: 0,
  prebuilt: null,
  notes: [],
});

describe("build drop alert", () => {
  it("fires only when the total drops by at least the threshold", () => {
    expect(buildDropAlert(result(160000), result(170000), 5000, 9)?.title).toBe("Your build dropped $100 - now $1,600");
    expect(buildDropAlert(result(168000), result(170000), 5000, 9)).toBeNull(); // only $20
    expect(buildDropAlert(result(175000), result(170000), 5000, 9)).toBeNull(); // went up
    expect(buildDropAlert(result(160000), null, 5000, 9)).toBeNull();
  });
  it("has a stable key per run so it's sent once", () => {
    expect(buildDropAlert(result(160000), result(170000), 5000, 9)?.key).toBe("build:9");
  });
});

describe("top pick drop alerts", () => {
  const item = (o: Partial<TopPickSnapshot["snapshot"]>): TopPickSnapshot => ({
    item_key: "p:5",
    snapshot: { title: "Ryzen 7 9800X3D", url: "https://x", price_cents: 63000, prev_price_cents: 70000, drop_cents: 7000, price_dropped: true, retailer_name: "Umart", ...o },
  });
  it("alerts on real drops above the % threshold only", () => {
    expect(topPickAlerts([item({})], 10)).toHaveLength(1); // 10%
    expect(topPickAlerts([item({})], 15)).toHaveLength(0);
    expect(topPickAlerts([item({ price_dropped: false })], 5)).toHaveLength(0);
  });
  it("keys include the price, so a further drop alerts again", () => {
    const [a] = topPickAlerts([item({})], 10);
    const [b] = topPickAlerts([item({ price_cents: 60000, drop_cents: 10000 })], 10);
    expect(a!.key).not.toBe(b!.key);
  });
});

describe("sendPush", () => {
  it("posts to the ntfy topic with ASCII-safe headers", async () => {
    let url = "";
    let init: RequestInit = {};
    await sendPush("pcfinder-abc123def456", { title: "Build ▼ $50 – now $1,600", message: "Body ✓", url: "https://x", tags: ["bell"] }, async (u, i) => {
      url = u;
      init = i;
      return new Response("ok");
    });
    expect(url).toBe("https://ntfy.sh/pcfinder-abc123def456");
    const h = init.headers as Record<string, string>;
    expect(h.Title).toBe("Build  $50  now $1,600");
    expect(h.Click).toBe("https://x");
    expect(init.body).toBe("Body ✓");
  });
  it("rejects bad topic names", async () => {
    await expect(sendPush("bad topic!", { title: "x", message: "y" }, async () => new Response("ok"))).rejects.toThrow();
  });
});
