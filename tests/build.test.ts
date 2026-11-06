import { describe, expect, it } from "vitest";
import type { Specs } from "../lib/ai/specs";
import { assemble, assembleBuilds, buildPools } from "../lib/build/assembler";
import {
  boardFormFactor,
  boardRamType,
  boardSocket,
  caseSupports,
  cpuNeedsCooler,
  cpuSocket,
  isCpuCooler,
  psuWatts,
  ramTypeOf,
  requiredPsuWatts,
} from "../lib/build/compat";
import type { Candidate, Scored } from "../lib/ranking/score";
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from "../lib/settings/schema";

let id = 0;
const cand = (category: string, title: string, price: number, specs: Partial<Specs> = {}): Candidate => ({
  key: `p:${++id}`,
  source: "product",
  category,
  title,
  url: `https://shop.test/${id}`,
  imageUrl: null,
  retailerId: "umart",
  retailerName: "Umart",
  melbournePickup: true,
  priceCents: price * 100,
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
  specs: { i: 0, category: category as Specs["category"], relevant: true, ...specs } as Specs,
});
const sc = (c: Candidate, score = 60): Scored => ({ c, score, breakdown: { fit: 0.8, budget: 1, discount: 0, convenience: 1, stock: 1, notes: [] } });

describe("compatibility facts (title fallbacks)", () => {
  it("CPU sockets", () => {
    expect(cpuSocket(cand("cpu", "AMD Ryzen 7 9800X3D 8-Core", 700))).toBe("AM5");
    expect(cpuSocket(cand("cpu", "AMD Ryzen 5 5600 6-Core", 150))).toBe("AM4");
    expect(cpuSocket(cand("cpu", "Intel Core Ultra 7 265K", 500))).toBe("LGA1851");
    expect(cpuSocket(cand("cpu", "Intel Core i5-14400F", 280))).toBe("LGA1700");
  });
  it("motherboard socket / RAM type / size from chipset and title", () => {
    const b = cand("motherboard", "MSI B650M GAMING PLUS WIFI Micro-ATX", 200);
    expect(boardSocket(b)).toBe("AM5");
    expect(boardRamType(b)).toBe("DDR5");
    expect(boardFormFactor(b)).toBe("mATX");
    expect(boardRamType(cand("motherboard", "ASUS PRIME B760M-A ATX", 150))).toBeNull(); // LGA1700 needs explicit DDR type
    expect(boardFormFactor(cand("motherboard", "ASUS ROG STRIX B850-I Mini-ITX", 400))).toBe("ITX");
  });
  it("case sizes", () => {
    expect(caseSupports(cand("case", "Montech XR ATX Mid Tower Case", 90))).toEqual(["ATX", "mATX", "ITX"]);
    expect(caseSupports(cand("case", "Lian Li A3-mATX Case", 100))).toEqual(["mATX", "ITX"]);
    expect(caseSupports(cand("case", "Cooler Master NR200 Mini-ITX Case", 120))).toEqual(["ITX"]);
  });
  it("PSU wattage, cooler detection and power needs", () => {
    expect(psuWatts(cand("psu", "Corsair RM850e 850W Gold", 150))).toBe(850);
    expect(isCpuCooler(cand("cooling", "DeepCool AK400 CPU Air Cooler", 45))).toBe(true);
    expect(isCpuCooler(cand("cooling", "Arctic P12 Case Fan 5 Pack", 40))).toBe(false);
    expect(cpuNeedsCooler(cand("cpu", "AMD Ryzen 5 7600 with Wraith Stealth", 300))).toBe(false);
    expect(cpuNeedsCooler(cand("cpu", "AMD Ryzen 7 9800X3D", 700))).toBe(true);
    const need = requiredPsuWatts(cand("cpu", "AMD Ryzen 7 9800X3D", 700), cand("gpu", "RTX 5070 Ti", 1200));
    expect(need).toBe(700); // (120 + 300 + 100) * 1.3 = 676 → 700
  });
});

const settings = (o: Partial<Settings> = {}): Settings => SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...o });

function catalogue() {
  return [
    sc(cand("gpu", "MSI GeForce RTX 5070 Ventus 12GB", 900), 80),
    sc(cand("gpu", "Gigabyte RTX 5060 Ti 16GB", 650), 65),
    sc(cand("cpu", "AMD Ryzen 7 9700X", 450), 75),
    sc(cand("cpu", "AMD Ryzen 5 7600 with Wraith Stealth", 280), 70),
    sc(cand("cpu", "Intel Core i5-14400F", 260), 72),
    sc(cand("motherboard", "MSI B650M GAMING PLUS WIFI Micro-ATX", 200), 70),
    sc(cand("motherboard", "ASUS PRIME B760M-A DDR4 mATX", 160), 75), // LGA1700 — wrong socket for AMD CPUs
    sc(cand("ram", "Corsair Vengeance 32GB (2x16GB) DDR5 6000", 160), 70),
    sc(cand("ram", "Kingston Fury 32GB DDR4 3200", 100), 75),
    sc(cand("ram", "Kingston 32GB DDR5 SODIMM Laptop", 120), 90), // laptop RAM — never used
    sc(cand("psu", "MSI MAG A550BN 550W", 70), 75),
    sc(cand("psu", "Corsair RM750e 750W Gold", 130), 70),
    sc(cand("case", "Cooler Master NR200 Mini-ITX Case", 120), 80), // too small for mATX
    sc(cand("case", "Montech XR ATX Mid Tower Case", 90), 70),
    sc(cand("storage", "Samsung 990 EVO Plus 1TB NVMe SSD", 120), 70),
    sc(cand("cooling", "DeepCool AK400 CPU Air Cooler", 45), 70),
  ];
}

describe("assembler", () => {
  const s = settings({ budget: { total: 2200, perCategory: {} } as Settings["budget"] });
  const budgets = { gpu: 90000, cpu: 45000, motherboard: 25000, ram: 20000, psu: 15000, case: 12000, storage: 15000, cooling: 8000 };

  it("produces a compatible build under budget", () => {
    const st = assemble(buildPools(catalogue(), s, budgets), 220000, [])!;
    expect(st).not.toBeNull();
    const p = st.parts;
    expect(cpuSocket(p.cpu!.c)).toBe(boardSocket(p.motherboard!.c));
    expect(ramTypeOf(p.ram!.c)).toBe(boardRamType(p.motherboard!.c));
    expect(p.ram!.c.title).not.toMatch(/SODIMM/);
    expect(p.case!.c.title).toMatch(/Mid Tower/);
    expect(st.price).toBeLessThanOrEqual(220000);
    // power: RTX 5070 + Ryzen → needs 650 W+, so the 550 W unit can't be chosen
    if (p.gpu!.c.title.includes("5070")) expect(p.psu!.c.title).toMatch(/750W/);
  });

  it("never pairs a CPU with a board of another socket, whatever the scores", () => {
    // Make the Intel board irresistible; with only AMD CPUs available it must still not be used.
    const cat = catalogue().filter((x) => !/Intel/.test(x.c.title));
    cat.find((x) => x.c.title.includes("B760M"))!.score = 100;
    const st = assemble(buildPools(cat, s, budgets), 220000, [])!;
    expect(boardSocket(st.parts.motherboard!.c)).toBe("AM5");
    expect(ramTypeOf(st.parts.ram!.c)).toBe("DDR5");
  });

  it("adds a cooler only when the CPU has none", () => {
    const st = assemble(buildPools(catalogue(), s, budgets), 220000, [])!;
    const hasStock = !cpuNeedsCooler(st.parts.cpu!.c);
    expect(!!st.parts.cooling).toBe(!hasStock);
  });

  it("respects a tight budget (or returns nothing rather than overspending)", () => {
    const st = assemble(buildPools(catalogue(), s, budgets), 140000, []);
    if (st) expect(st.price).toBeLessThanOrEqual(140000);
    expect(assemble(buildPools(catalogue(), s, budgets), 50000, [])).toBeNull();
  });

  it("skips owned categories", () => {
    const st = assemble(buildPools(catalogue(), s, budgets), 220000, ["gpu", "case"])!;
    expect(st.parts.gpu).toBeUndefined();
    expect(st.parts.case).toBeUndefined();
    expect(st.parts.cpu).toBeDefined();
  });

  it("assembleBuilds returns best/cheaper/stretch with checks, and extras", () => {
    const withMonitor = settings({
      budget: { total: 2500, perCategory: {} } as Settings["budget"],
      extras: { ...DEFAULT_SETTINGS.extras, monitor: true },
    });
    const cat = [...catalogue(), sc(cand("monitor", "AOC Q27G40E 27in 1440p 180Hz", 250), 70)];
    const r = assembleBuilds(cat, withMonitor, budgets);
    expect(r.extras.map((e) => e.category)).toEqual(["monitor"]);
    expect(r.budgetCents).toBe(250000 - 25000); // monitor cost comes out of the build budget
    const best = r.builds.find((b) => b.label === "best")!;
    expect(best.totalCents).toBeLessThanOrEqual(r.budgetCents);
    expect(best.checks.join(" ")).toMatch(/socket (AM5|LGA1700)/);
    expect(best.checks.join(" ")).toMatch(/memory matches the motherboard/);
    for (const b of r.builds) expect(b.totalCents).toBeLessThanOrEqual(b.limitCents);
  });
});
