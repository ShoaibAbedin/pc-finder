import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_QUERIES, parseStaticIce, queriesFromTargets } from "../scrapers/sources/staticice";

const html = readFileSync(new URL("./fixtures/staticice-rtx5070.html", import.meta.url), "latin1");

describe("StaticICE parser (real saved page)", () => {
  const items = parseStaticIce(html, "gpu", "rtx 5070");

  it("extracts offers with seller, price and title", () => {
    expect(items.length).toBeGreaterThan(5);
    for (const i of items) {
      expect(i.priceCents).toBeGreaterThan(0);
      expect(i.seller?.name.length).toBeGreaterThan(1);
      expect(i.url).toContain("staticice.com.au/cgi-bin/search.cgi?q=rtx%205070");
      expect(i.title).not.toMatch(/\[Avail/);
    }
  });

  it("flags Victorian stores and reads stock hints", () => {
    const ple = items.find((i) => i.seller?.name === "PLE Computers")!;
    expect(ple.seller?.vic).toBe(true);
    expect(ple.priceCents).toBe(39900);
    const sky = items.find((i) => i.seller?.name === "SkyComp Technology")!;
    expect(sky.seller?.vic).toBe(false);
    expect(sky.inStock).toBe(true);
  });

  it("skips stores we already scrape directly (no duplicates)", () => {
    expect(items.some((i) => /mwave|umart|msy/i.test(i.seller!.name))).toBe(false);
  });

  it("gives stable IDs per store+title", () => {
    const again = parseStaticIce(html, "gpu", "rtx 5070");
    expect(again.map((i) => i.externalId)).toEqual(items.map((i) => i.externalId));
  });
});

describe("queriesFromTargets", () => {
  it("uses specific recommended models, skips generic words, caps the total", () => {
    const q = queriesFromTargets({
      targets: {
        gpu: { prefer: ["RTX 5070", "RX 9070", "quiet", "RTX 5070 Ti", "RTX 5080"] },
        cpu: { prefer: ["Ryzen 7 9700X"] },
        ram: { prefer: ["DDR5", "32GB DDR5-6000"] },
        storage: { prefer: ["2TB NVMe"] },
      },
    });
    // AI picks first, then popular parts fill up to 30 (no duplicates)
    expect(q.slice(0, 6).map((x) => x.q)).toEqual(["rtx 5070", "rx 9070", "rtx 5070 ti", "ryzen 7 9700x", "32gb ddr5-6000", "2tb nvme"]);
    expect(q.length).toBeLessThanOrEqual(30);
    expect(q.length).toBeGreaterThan(20);
    expect(new Set(q.map((x) => x.q)).size).toBe(q.length);
  });
  it("falls back to defaults without targets", () => {
    expect(queriesFromTargets(null)).toEqual(DEFAULT_QUERIES.slice(0, 30));
  });
});
