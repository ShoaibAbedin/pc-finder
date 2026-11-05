import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseShopifyProducts } from "../scrapers/sources/mwave";

const json = JSON.parse(readFileSync(new URL("./fixtures/mwave-graphics-cards.json", import.meta.url), "utf8"));

describe("parseShopifyProducts (Mwave fixture)", () => {
  const listings = parseShopifyProducts(json, "gpu");

  it("produces a listing per product with valid fields", () => {
    expect(listings.length).toBe(json.products.length);
    for (const l of listings) {
      expect(l.category).toBe("gpu");
      expect(l.url).toMatch(/^https:\/\/www\.mwave\.com\.au\/products\//);
      expect(l.priceCents).toBeGreaterThan(0);
      expect(Number.isInteger(l.priceCents)).toBe(true);
      expect(typeof l.inStock).toBe("boolean");
    }
  });

  it("splits multi-variant products and ignores 'was' prices that aren't higher", () => {
    const out = parseShopifyProducts(
      {
        products: [
          {
            id: 1,
            title: "Fan",
            handle: "fan",
            variants: [
              { id: 11, title: "Black", sku: "A", price: "20.00", compare_at_price: "25.00", available: true },
              { id: 12, title: "White", sku: "B", price: "22.00", compare_at_price: "22.00", available: false },
            ],
          },
        ],
      },
      "cooling",
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ externalId: "11", title: "Fan — Black", priceCents: 2000, retailerWasPriceCents: 2500 });
    expect(out[1]).toMatchObject({ externalId: "12", inStock: false, retailerWasPriceCents: null });
    expect(out[1]!.url).toContain("?variant=12");
  });
});
