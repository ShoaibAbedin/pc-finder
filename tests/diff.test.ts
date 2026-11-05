import { describe, expect, it } from "vitest";
import { classifyListing, statusFor, type ExistingProduct } from "../lib/db/diff";
import type { RawListing } from "../scrapers/core/types";

const listing = (o: Partial<RawListing> = {}): RawListing => ({
  externalId: "1",
  title: "GPU",
  url: "https://x",
  category: "gpu",
  priceCents: 100000,
  inStock: true,
  ...o,
});
const existing = (o: Partial<ExistingProduct> = {}): ExistingProduct => ({
  id: 1,
  external_id: "1",
  current_price_cents: 100000,
  in_stock: true,
  status: "active",
  last_changed_at: "2026-11-01T00:00:00Z",
  ...o,
});

describe("classifyListing", () => {
  it("new when not in DB", () => expect(classifyListing(undefined, listing())).toBe("new"));
  it("unchanged when price and stock match", () => expect(classifyListing(existing(), listing())).toBe("unchanged"));
  it("changed on price drop", () => expect(classifyListing(existing(), listing({ priceCents: 90000 }))).toBe("changed"));
  it("changed on stock change", () => expect(classifyListing(existing(), listing({ inStock: false }))).toBe("changed"));
  it("changed when an expired product reappears", () =>
    expect(classifyListing(existing({ status: "expired" }), listing())).toBe("changed"));
});

describe("statusFor", () => {
  it("out of stock only when explicitly false", () => {
    expect(statusFor(listing({ inStock: false }))).toBe("out_of_stock");
    expect(statusFor(listing({ inStock: null }))).toBe("active");
  });
});
