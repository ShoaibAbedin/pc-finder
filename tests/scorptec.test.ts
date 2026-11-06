import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseScorptecListing } from "../scrapers/sources/scorptec";

const html = readFileSync(new URL("./fixtures/scorptec-gpu-nvidia.html", import.meta.url), "utf8");

describe("Scorptec listing parser (real saved page)", () => {
  const items = parseScorptecListing(html, "gpu", "graphics-cards/nvidia");

  it("finds every product with unique IDs", () => {
    expect(items.length).toBeGreaterThan(200);
    expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length);
  });

  it("extracts title, URL, image, price, was-price and stock", () => {
    const p = items.find((i) => i.externalId === "122878")!;
    expect(p.title).toBe("Palit GeForce RTX 5060 Infinity 2 OC, 8GB");
    expect(p.url).toBe("https://www.scorptec.com.au/product/graphics-cards/nvidia/122878-ne75060v19p1-gb2063l");
    expect(p.priceCents).toBe(64900);
    expect(p.retailerWasPriceCents).toBe(69900); // stored for reference only
    expect(p.inStock).toBe(true);
    expect(p.imageUrl).toMatch(/^https:\/\/prod\.scorptec\.com\.au\//);
    expect(p.sku).toBe("NE75060V19P1-GB2063L");
  });

  it("maps sold out / limited stock", () => {
    expect(items.some((i) => i.inStock === false)).toBe(true);
    expect(items.filter((i) => i.inStock === true).length).toBeGreaterThan(30);
  });
});

describe("Scorptec hidden (not yet rendered) products", () => {
  const items = parseScorptecListing(html, "gpu", "graphics-cards/nvidia");
  it("reads data attributes and rebuilds the product URL", () => {
    const p = items.find((i) => i.externalId === "128341")!;
    expect(p.title).toBe("Gigabyte AORUS GeForce RTX 5080 INFINITY WOOD 16G");
    expect(p.priceCents).toBe(349900);
    expect(p.inStock).toBe(true);
    expect(p.url).toMatch(/^https:\/\/www\.scorptec\.com\.au\/product\/graphics-cards\/nvidia\/128341-[a-z0-9-]+$/);
  });
});
