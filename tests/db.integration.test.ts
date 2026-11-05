/**
 * Runs against the real Supabase database (skipped if keys aren't set).
 * Uses a throwaway retailer id "zz-test" and cleans up after itself.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient, loadEnv } from "../lib/db/client";
import { expireMissingProducts, saveListings } from "../lib/db/save";
import type { RawListing } from "../scrapers/core/types";

loadEnv();
const hasDb = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_URL.includes("YOUR-");
const R = "zz-test";

const L = (id: string, price: number, inStock = true, category: RawListing["category"] = "gpu"): RawListing => ({
  externalId: id,
  title: `Test ${id}`,
  url: `https://example.test/${id}`,
  category,
  priceCents: price,
  inStock,
});

describe.skipIf(!hasDb)("database save + expiry (live Supabase)", () => {
  const db = hasDb ? createServiceClient() : (null as never);
  const ts = (min: number) => new Date(Date.UTC(2026, 10, 5, 0, min)).toISOString();

  const cleanup = async () => {
    await db.from("products").delete().eq("retailer_id", R);
    await db.from("retailers").delete().eq("id", R);
  };
  beforeAll(async () => {
    await cleanup();
    const { error } = await db.from("retailers").insert({ id: R, name: "Test", website: "https://example.test", kind: "retailer" });
    if (error) throw new Error(error.message);
  });
  afterAll(cleanup);

  const product = async (id: string) =>
    (await db.from("products").select("*").eq("retailer_id", R).eq("external_id", id).single()).data;
  const historyCount = async (id: string) => {
    const p = await product(id);
    const { count } = await db.from("price_history").select("*", { count: "exact", head: true }).eq("product_id", p.id);
    return count;
  };

  it("run 1: inserts products + one history row each", async () => {
    const r = await saveListings(db, R, [L("a", 1000), L("b", 2000), L("c", 3000), L("m", 500, true, "monitor")], ts(0));
    expect(r).toEqual({ found: 4, new: 4, changed: 0 });
    expect(await historyCount("a")).toBe(1);
  });

  it("run 2: unchanged adds no history; price drop + stock change add history; c is missing", async () => {
    const r = await saveListings(db, R, [L("a", 1000), L("b", 1500), L("m", 500, false, "monitor")], ts(10));
    expect(r).toEqual({ found: 3, new: 0, changed: 2 });
    expect(await historyCount("a")).toBe(1);
    expect(await historyCount("b")).toBe(2);
    expect((await product("b")).current_price_cents).toBe(1500);
    expect((await product("m")).status).toBe("out_of_stock");

    // only "gpu" was fully scraped; c missed once → not yet expired
    expect(await expireMissingProducts(db, R, ["gpu"], ts(10), 2)).toBe(0);
    expect((await product("c")).missed_runs).toBe(1);
    expect((await product("c")).status).toBe("active");
  });

  it("run 3: c missing again → expired; incomplete categories are left alone", async () => {
    await saveListings(db, R, [L("a", 1000), L("b", 1500)], ts(20));
    // monitor category NOT in completed list (e.g. that scrape failed) → m must not be touched
    expect(await expireMissingProducts(db, R, ["gpu"], ts(20), 2)).toBe(1);
    expect((await product("c")).status).toBe("expired");
    expect((await product("m")).missed_runs).toBe(0);
  });

  it("run 4: expired product reappears → active again with a history row", async () => {
    const r = await saveListings(db, R, [L("c", 2500)], ts(30));
    expect(r.changed).toBe(1);
    const c = await product("c");
    expect(c.status).toBe("active");
    expect(c.missed_runs).toBe(0);
    expect(c.expired_at).toBeNull();
    expect(await historyCount("c")).toBe(2);
  });
});
