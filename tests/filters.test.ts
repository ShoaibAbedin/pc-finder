import { describe, expect, it } from "vitest";
import { activeFilterCount, parseFilters, searchTerms, toQueryString } from "../lib/deals/filters";
import { formatPrice, timeAgo } from "../lib/format";

describe("parseFilters", () => {
  it("has sensible defaults", () => {
    expect(parseFilters({})).toEqual({
      q: "",
      minDollars: undefined,
      maxDollars: undefined,
      retailers: [],
      pickupOnly: false,
      inStockOnly: true,
      sort: "match",
      page: 1,
    });
  });

  it("parses all params", () => {
    const f = parseFilters({ q: " rtx 5070 ", min: "$300", max: "1,200", r: ["mwave", "Scorptec"], pickup: "1", stock: "all", sort: "price_asc", page: "3" });
    expect(f).toMatchObject({ q: "rtx 5070", minDollars: 300, maxDollars: 1200, retailers: ["mwave", "scorptec"], pickupOnly: true, inStockOnly: false, sort: "price_asc", page: 3 });
  });

  it("rejects bad input", () => {
    const f = parseFilters({ min: "abc", max: "-5", r: "bad id!", sort: "hack", page: "-2" });
    expect(f).toMatchObject({ minDollars: undefined, maxDollars: undefined, retailers: [], sort: "match", page: 1 });
  });

  it("swaps min/max if reversed", () => {
    expect(parseFilters({ min: "900", max: "100" })).toMatchObject({ minDollars: 100, maxDollars: 900 });
  });
});

describe("toQueryString", () => {
  it("omits defaults and round-trips", () => {
    expect(toQueryString(parseFilters({}))).toBe("");
    const sp = { q: "ssd", max: "200", r: ["mwave"], stock: "all", sort: "new" };
    const qs = toQueryString(parseFilters(sp));
    const back = Object.fromEntries(new URLSearchParams(qs));
    expect(parseFilters(back)).toEqual(parseFilters(sp));
  });
  it("applies overrides (pagination)", () => {
    expect(toQueryString(parseFilters({ q: "gpu" }), { page: 2 })).toBe("?q=gpu&page=2");
  });
});

describe("searchTerms", () => {
  it("strips characters that would break PostgREST/LIKE filters", () => {
    expect(searchTerms('rtx,5070 (ti) 100% "oc"')).toEqual(["rtx", "5070", "ti", "100", "oc"]);
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("activeFilterCount", () => {
  it("counts non-default filters", () => {
    expect(activeFilterCount(parseFilters({}))).toBe(0);
    expect(activeFilterCount(parseFilters({ min: "1", pickup: "1", stock: "all" }))).toBe(3);
  });
});

describe("format", () => {
  it("formats AUD", () => {
    expect(formatPrice(129900)).toBe("$1,299");
    expect(formatPrice(4597)).toBe("$45.97");
    expect(formatPrice(null)).toBe("—");
  });
  it("time ago", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    expect(timeAgo("2026-11-05T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-11-05T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo(null, now)).toBe("never");
  });
});
