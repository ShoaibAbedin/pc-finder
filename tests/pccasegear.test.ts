import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePccgListing } from "../scrapers/sources/pccasegear";

const load = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

describe("PCCG listing parser (real saved pages)", () => {
  const gpus = parsePccgListing(load("pccg-gpu-nvidia.html"), "gpu");
  const psus = parsePccgListing(load("pccg-psu-all.html"), "psu");

  it("finds every product on the page", () => {
    expect(gpus.length).toBeGreaterThan(100);
    expect(psus.length).toBeGreaterThan(100);
    expect(new Set(gpus.map((g) => g.externalId)).size).toBe(gpus.length);
  });

  it("extracts title, absolute URL, integer price and stock", () => {
    const g = gpus.find((x) => x.externalId === "68594")!;
    expect(g.title).toBe("MSI GeForce RTX 5070 Ti Ventus 3X OC GDDR7 16GB");
    expect(g.url).toBe("https://www.pccasegear.com/products/68594/msi-geforce-rtx-5070-ti-ventus-3x-oc-gddr7-16gb");
    expect(g.priceCents).toBe(214900);
    expect(g.inStock).toBe(true);
    expect(g.category).toBe("gpu");
    for (const x of [...gpus, ...psus]) {
      expect(x.url).toMatch(/^https:\/\/www\.pccasegear\.com\/products\/\d+/);
      if (x.priceCents !== null) expect(Number.isInteger(x.priceCents)).toBe(true);
    }
  });

  it("maps Sold Out to out of stock and Stock at Supplier to available", () => {
    expect(gpus.some((x) => x.inStock === false)).toBe(true);
    expect(gpus.filter((x) => x.inStock === true).length).toBeGreaterThan(40);
  });
});
