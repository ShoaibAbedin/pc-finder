import { describe, expect, it } from "vitest";
import type { Specs } from "../lib/ai/specs";
import type { Targets } from "../lib/ai/targets";
import { buildPartIndex, norm, partsTotalFor } from "../lib/ranking/prebuilt";
import { categoryBudgets, excludeReason, scoreCandidate, selectForYou, templateReason, type Candidate } from "../lib/ranking/score";
import { DEFAULT_SETTINGS, SettingsSchema, settingsHash, type Settings } from "../lib/settings/schema";

const specs = (o: Partial<Specs>): Specs =>
  ({ i: 0, category: "gpu", relevant: true, ...Object.fromEntries(Object.keys({}).map((k) => [k, null])), ...o }) as Specs;

let id = 0;
const cand = (o: Partial<Candidate>): Candidate => ({
  key: `p:${++id}`,
  source: "product",
  category: "gpu",
  title: "Some GPU",
  url: "https://x",
  imageUrl: null,
  retailerId: "mwave",
  retailerName: "Mwave",
  melbournePickup: false,
  priceCents: 80000,
  status: "active",
  inStock: true,
  prevPriceCents: null,
  dropCents: null,
  dropPct: null,
  high30Cents: null,
  historyPoints: 1,
  is30dLow: false,
  priceDropped: false,
  isNew: false,
  ...o,
});

const settings = (o: Partial<Settings> = {}): Settings => SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...o });

const targets: Targets = {
  summary: "1440p gaming",
  budget_split_pct: { gpu: 40, cpu: 20 },
  platform: { socket: "AM5", ram_type: "DDR5", min_psu_w: 750, form_factor: null },
  targets: { gpu: { min_tier: 5, ideal_tier: 7, prefer: ["RTX 5070"], avoid: [], notes: "" } },
  monitor: null,
};

describe("budgets", () => {
  it("splits the total by AI percentages; explicit limits win", () => {
    const s = settings({ budget: { total: 2000, perCategory: { cpu: 300 } } as Settings["budget"] });
    const b = categoryBudgets(s, targets);
    expect(b.gpu).toBe(80000); // 40% of $2000
    expect(b.cpu).toBe(30000); // explicit $300
    expect(b.ram).toBeGreaterThan(0); // default split fills gaps
  });
});

describe("exclusions", () => {
  const s = settings({ owned: { categories: ["psu"], notes: "" }, requirements: { ...DEFAULT_SETTINGS.requirements, avoidBrands: ["Gigabyte"] } });
  it.each([
    [cand({ category: "psu" }), "already owned"],
    [cand({ category: "monitor" }), "monitor not wanted"],
    [cand({ title: "Gigabyte RTX 5070", specs: specs({ brand: "Gigabyte" }) }), "avoided brand"],
    [cand({ specs: specs({ relevant: false }) }), "not relevant"],
    [cand({ priceCents: null }), "no price"],
  ])("%#", (c, reason) => expect(excludeReason(c, s)).toBe(reason));

  it("respects build/prebuilt mode", () => {
    expect(excludeReason(cand({ category: "prebuilt" }), settings({ mode: "build" }))).toBe("build mode");
    expect(excludeReason(cand({ category: "gpu" }), settings({ mode: "prebuilt" }))).toBe("prebuilt mode");
  });
});

describe("scoring", () => {
  const s = settings({ budget: { total: 2000, perCategory: {} } as Settings["budget"] });
  const budgets = categoryBudgets(s, targets);
  const score = (c: Candidate) => scoreCandidate(c, s, targets, budgets)!;

  it("prefers the right tier over a too-weak card", () => {
    const right = score(cand({ specs: specs({ tier: 7, model: "RTX 5070" }), title: "RTX 5070" }));
    const weak = score(cand({ specs: specs({ tier: 3 }) }));
    expect(right.score).toBeGreaterThan(weak.score);
    expect(right.breakdown.notes.join(" ")).toMatch(/right tier/);
  });

  it("rewards real discounts from price history, not retailer 'was' prices", () => {
    const flat = score(cand({ high30Cents: 80000, historyPoints: 3 }));
    const dropped = score(cand({ priceCents: 68000, high30Cents: 80000, historyPoints: 3, is30dLow: true }));
    expect(dropped.breakdown.discount).toBeGreaterThan(flat.breakdown.discount);
    expect(dropped.breakdown.notes.join(" ")).toMatch(/15% below its 30-day high/);
  });

  it("boosts Melbourne click & collect", () => {
    const pickup = score(cand({ melbournePickup: true, retailerName: "Scorptec" }));
    const ship = score(cand({}));
    expect(pickup.score - ship.score).toBeCloseTo(15 * 0.4, 1);
  });

  it("penalises over-budget and drops far-over-budget items", () => {
    expect(score(cand({ priceCents: 95000 })).breakdown.budget).toBeLessThan(1);
    expect(scoreCandidate(cand({ priceCents: 200000 }), s, targets, budgets)).toBeNull();
  });

  it("out of stock scores zero for stock and is excluded from For You", () => {
    const oos = score(cand({ status: "out_of_stock", inStock: false }));
    expect(oos.breakdown.stock).toBe(0);
    expect(selectForYou([oos])).toHaveLength(0);
  });

  it("penalises wrong platform (socket / RAM type)", () => {
    const am5 = score(cand({ category: "cpu", priceCents: 35000, specs: specs({ socket: "AM5" }) }));
    const lga = score(cand({ category: "cpu", priceCents: 35000, specs: specs({ socket: "LGA1700" }) }));
    expect(am5.breakdown.fit).toBeGreaterThan(lga.breakdown.fit);
  });

  it("works without specs or targets (neutral fit)", () => {
    const x = scoreCandidate(cand({}), s, null, categoryBudgets(s, null))!;
    expect(x.breakdown.fit).toBe(0.5);
    expect(x.score).toBeGreaterThan(0);
  });
});

describe("For You selection", () => {
  it("limits items per category and removes duplicates", () => {
    const s = settings();
    const b = categoryBudgets(s, null);
    const many = Array.from({ length: 10 }, (_, i) => scoreCandidate(cand({ title: `GPU ${i}` }), s, null, b)!);
    const dup = scoreCandidate(cand({ title: "GPU 0" }), s, null, b)!;
    const picked = selectForYou([...many, dup], 30, 4);
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((p) => p.c.title)).size).toBe(4);
  });
  it("template reason uses positive facts", () => {
    const s = settings();
    const x = scoreCandidate(cand({ melbournePickup: true, retailerName: "Scorptec" }), s, null, categoryBudgets(s, null))!;
    expect(templateReason(x)).toMatch(/budget|Melbourne/);
  });
});

describe("prebuilt vs parts", () => {
  const parts = [
    cand({ category: "gpu", priceCents: 90000, specs: specs({ gpu_chip: "GeForce RTX 5070" }) }),
    cand({ category: "cpu", priceCents: 40000, specs: specs({ cpu_model: "Ryzen 7 9700X", socket: "AM5" }) }),
    cand({ category: "motherboard", priceCents: 20000, specs: specs({ socket: "AM5" }) }),
    cand({ category: "ram", title: "32GB DDR5", priceCents: 15000, specs: specs({ capacity_gb: 32 }) }),
    cand({ category: "storage", priceCents: 10000, specs: specs({ capacity_gb: 1000, storage_type: "NVMe" }) }),
    cand({ category: "psu", priceCents: 12000, specs: specs({ wattage: 750 }) }),
    cand({ category: "case", priceCents: 9000, specs: specs({ tier: 4 }) }),
    cand({ category: "cooling", priceCents: 5000, specs: specs({ cooler_type: "air", tier: 4 }) }),
    cand({ category: "gpu", priceCents: 50000, status: "out_of_stock", specs: specs({ gpu_chip: "RTX 5070" }) }), // ignored
  ];
  const idx = buildPartIndex(parts);

  it("normalises model names", () => expect(norm("NVIDIA GeForce RTX 5070")).toBe(norm("RTX 5070")));

  it("adds up cheapest in-stock matching parts", () => {
    const pb = cand({
      category: "prebuilt",
      priceCents: 180000,
      specs: specs({ pb_gpu: "RTX 5070", pb_cpu: "AMD Ryzen 7 9700X", pb_ram_gb: 32, pb_storage_gb: 1000, pb_psu_w: 650 }),
    });
    const r = partsTotalFor(pb, idx);
    expect(r.missing).toEqual([]);
    expect(r.cents).toBe(90000 + 40000 + 20000 + 15000 + 10000 + 12000 + 9000 + 5000);
  });

  it("refuses to compare when CPU/GPU can't be matched", () => {
    const pb = cand({ category: "prebuilt", specs: specs({ pb_gpu: "RTX 9999", pb_cpu: "Ryzen 7 9700X" }) });
    expect(partsTotalFor(pb, idx).cents).toBeNull();
  });
});

describe("settingsHash", () => {
  it("is stable regardless of key order and changes with content", () => {
    const a = settings();
    const b = JSON.parse(JSON.stringify(a));
    expect(settingsHash(a)).toBe(settingsHash(b));
    expect(settingsHash(settings({ budget: { total: 3000, perCategory: {} } as Settings["budget"] }))).not.toBe(settingsHash(a));
  });
});
