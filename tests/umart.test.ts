import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseUmartListing } from "../scrapers/sources/umart";

const load = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

describe.each([
  ["Umart", "umart-gpu.html", "https://www.umart.com.au"],
  ["MSY", "msy-gpu.html", "https://www.msy.com.au"],
])("%s listing parser (real saved page)", (_name, file, base) => {
  const { items, lastPage } = parseUmartListing(load(file), "gpu", base);

  it("finds the 20 products on the page and the page count", () => {
    expect(items).toHaveLength(20);
    expect(lastPage).toBeGreaterThan(1);
  });

  it("extracts IDs, titles, absolute URLs, prices, stock and images", () => {
    for (const i of items) {
      expect(i.externalId).toMatch(/^\d+$/);
      expect(i.title.length).toBeGreaterThan(5);
      expect(i.url.startsWith(`${base}/product/`)).toBe(true);
      expect(i.priceCents).toBeGreaterThan(0);
      expect(typeof i.inStock).toBe("boolean");
    }
  });
});

it("Umart: specific product", () => {
  const { items } = parseUmartListing(load("umart-gpu.html"), "gpu", "https://www.umart.com.au");
  const p = items.find((i) => i.externalId === "82678")!;
  expect(p.title).toBe("Asus Dual GeForce RTX 5060 Ti O8G Graphics Card (DUAL-RTX5060TI-O8G)");
  expect(p.priceCents).toBe(94900);
  expect(p.sku).toBe("DUAL-RTX5060TI-O8G");
  expect(p.brand).toBe("Asus");
  expect(p.imageUrl).toMatch(/^https:\/\/assets\.umart\.com\.au\//);
});
