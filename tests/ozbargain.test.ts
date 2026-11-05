import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchRetailer } from "../scrapers/core/retailers";
import { categoryFromTags, parseOzBargainFeed } from "../scrapers/sources/ozbargain";

const xml = readFileSync(new URL("./fixtures/ozbargain-computing.xml", import.meta.url), "utf8");
// Fixed "now" so expiry checks are deterministic against the saved fixture.
const NOW = new Date("2026-11-05T12:00:00+11:00");

describe("parseOzBargainFeed (fixture)", () => {
  const deals = parseOzBargainFeed(xml, NOW);

  it("parses every item with required fields", () => {
    expect(deals.length).toBeGreaterThan(5);
    for (const d of deals) {
      expect(d.nodeId).toMatch(/^\d+$/);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.link).toContain("ozbargain.com.au/node/");
    }
    expect(new Set(deals.map((d) => d.nodeId)).size).toBe(deals.length);
  });

  it("reads the expired X870 motherboard deal correctly", () => {
    const d = deals.find((x) => x.nodeId === "981695");
    expect(d).toBeDefined();
    expect(d!.priceCents).toBe(4600);
    expect(d!.expired).toBe(true);
    expect(d!.category).toBe("motherboard");
    expect(d!.store).toBe("JW Computers");
    expect(d!.dealUrl).toContain("jw.com.au");
    expect(d!.votesPos).toBe(30);
    expect(d!.postedAt).toBe("2026-11-04T22:09:04.000Z");
  });

  it("prefers the A$ amount for foreign-priced deals and keeps future-expiry deals active", () => {
    const d = deals.find((x) => x.nodeId === "981456");
    expect(d!.priceCents).toBe(6580);
    expect(d!.expired).toBe(false);
    expect(d!.category).toBe("monitor");
  });
});

describe("helpers", () => {
  it("maps tags to categories", () => {
    expect(categoryFromTags(["graphics-card", "nvidia"])).toBe("gpu");
    expect(categoryFromTags(["ssd", "samsung"])).toBe("storage");
    expect(categoryFromTags(["random"])).toBe("other");
    expect(categoryFromTags(["computer-component", "video-card"])).toBe("gpu");
    expect(categoryFromTags(["laptop", "ssd", "ram"])).toBe("other");
    expect(categoryFromTags(["mini-pc", "ddr5"])).toBe("prebuilt");
  });
  it("matches retailers by url then name", () => {
    expect(matchRetailer("Some Store", "https://www.scorptec.com.au/product/x")).toBe("scorptec");
    expect(matchRetailer("PC Case Gear")).toBe("pccasegear");
    expect(matchRetailer("JB Hi-Fi")).toBe("jbhifi");
    expect(matchRetailer("Amazon AU")).toBe("amazon-au");
    expect(matchRetailer("AliExpress")).toBeUndefined();
  });
});
