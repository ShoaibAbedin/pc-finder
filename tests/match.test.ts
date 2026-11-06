import { describe, expect, it } from "vitest";
import { sameProduct } from "../lib/ranking/match";

const p = (title: string, category = "gpu") => ({ title, category });

describe("sameProduct (cross-store matching)", () => {
  it("matches the same card worded differently by two stores", () => {
    expect(sameProduct(p("MSI GeForce RTX 5070 Ti Ventus 3X OC GDDR7 16GB"), p("MSI GeForce RTX 5070 Ti 16G VENTUS 3X OC Graphics Card"))).toBe(true);
    expect(sameProduct(p("Corsair RM850e 850W 80+ Gold Fully Modular ATX Power Supply", "psu"), p("Corsair RM850e 850W Gold Modular PSU", "psu"))).toBe(true);
  });
  it("doesn't match different models, brands or categories", () => {
    expect(sameProduct(p("MSI GeForce RTX 5070 Ti Ventus 3X OC 16GB"), p("MSI GeForce RTX 5070 Ventus 3X OC 12GB"))).toBe(false);
    expect(sameProduct(p("MSI GeForce RTX 5070 Ventus 2X"), p("Gigabyte GeForce RTX 5070 Windforce"))).toBe(false);
    expect(sameProduct(p("Corsair RM850e 850W", "psu"), p("Corsair RM750e 750W", "psu"))).toBe(false);
    expect(sameProduct(p("Samsung 990 Pro 2TB", "storage"), p("Samsung 990 Pro 2TB", "gpu"))).toBe(false);
  });
});

describe("sameProduct variants", () => {
  it("never merges a Ti/Super/XT/X3D with the base model", () => {
    expect(sameProduct(p("MSI GeForce RTX 5070 Ti Ventus 3X OC"), p("MSI GeForce RTX 5070 Ventus 3X OC"))).toBe(false);
    expect(sameProduct(p("AMD Ryzen 7 7800X3D", "cpu"), p("AMD Ryzen 7 7800X", "cpu"))).toBe(false);
    expect(sameProduct(p("Sapphire Pulse Radeon RX 9070 XT 16GB"), p("Sapphire Pulse Radeon RX 9070 16GB"))).toBe(false);
  });
});
