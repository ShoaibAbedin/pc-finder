import { describe, expect, it } from "vitest";
import { parseAudPriceFromTitle, toCents } from "../scrapers/core/price";

describe("toCents", () => {
  it("parses common formats", () => {
    expect(toCents("1299.00")).toBe(129900);
    expect(toCents("1,299")).toBe(129900);
    expect(toCents("$45.5")).toBe(4550);
    expect(toCents(19.99)).toBe(1999);
  });
  it("rejects junk", () => {
    expect(toCents(null)).toBeNull();
    expect(toCents("")).toBeNull();
    expect(toCents("abc")).toBeNull();
    expect(toCents("0")).toBeNull();
  });
});

describe("parseAudPriceFromTitle", () => {
  it.each([
    ["Asus TUF GAMING X870-PRO WIFI7 W NEO AM5 $46 + Delivery @ JW Computers", 4600],
    ["Amoudo 15.6 Inch Portable Monitor US$45.97 (~A$65.80) Delivered @ AliExpress", 6580],
    ["Samsung 990 Pro 2TB $239 (Was $299) + Delivery @ Scorptec", 23900],
    ["AMD Ryzen 7 9800X3D $1,099.00 Delivered @ Amazon AU", 109900],
    ["$50 off RTX 5070, now $899 @ PCCaseGear", 89900],
    ["Spend $300 get bonus, Corsair RM850x $149 @ Umart", 14900],
  ])("%s", (title, cents) => {
    expect(parseAudPriceFromTitle(title)).toBe(cents);
  });

  it("returns null for foreign-only or no price", () => {
    expect(parseAudPriceFromTitle("Keyboard US$29.99 @ AliExpress")).toBeNull();
    expect(parseAudPriceFromTitle("20% off sitewide @ Mwave")).toBeNull();
  });
});
