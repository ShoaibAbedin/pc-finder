import { estimateTier } from "../ranking/tiers";
import type { Settings } from "../settings/schema";
import type { Scored } from "../ranking/score";
import {
  boardFormFactor,
  boardHasWifi,
  boardRamType,
  boardSocket,
  caseSupports,
  cpuNeedsCooler,
  cpuSocket,
  isCpuCooler,
  isDesktopRam,
  isInternalSsd,
  psuWatts,
  ramCapacityGb,
  ramTypeOf,
  requiredPsuWatts,
  storageGb,
} from "./compat";

/**
 * Phase 6: assemble a complete, compatible build from current in-stock deals.
 * Deterministic beam search over the best-scoring parts per category. Prices come only from scraped listings.
 */

export type BuildCategory = "gpu" | "cpu" | "motherboard" | "ram" | "psu" | "case" | "storage" | "cooling";
const ORDER: BuildCategory[] = ["gpu", "cpu", "motherboard", "ram", "psu", "case", "storage", "cooling"];
/** How much each part's quality matters to the build as a whole. */
// cooling weighs 0: a needed cooler is a cost, not an upgrade (otherwise builds with coolers look "better").
const WEIGHT: Record<BuildCategory, number> = { gpu: 3, cpu: 2, motherboard: 1, ram: 1, psu: 0.7, case: 0.6, storage: 0.8, cooling: 0 };
const BEAM = 80;

export interface BuildPart {
  category: BuildCategory | "monitor" | "peripheral" | "software" | "prebuilt";
  key: string;
  title: string;
  priceCents: number;
  retailer: string | null;
  url: string;
  pickup: boolean;
  imageUrl: string | null;
}

export interface Build {
  label: "best" | "cheaper" | "stretch";
  limitCents: number;
  totalCents: number;
  parts: BuildPart[];
  checks: string[];
  owned: BuildCategory[];
}

export interface BuildResult {
  budgetCents: number;
  builds: Build[];
  extras: BuildPart[];
  extrasTotalCents: number;
  prebuilt: { part: BuildPart; diffCents: number } | null;
  notes: string[];
}

const toPart = (x: Scored, category: BuildPart["category"]): BuildPart => ({
  category,
  key: x.c.key,
  title: x.c.title,
  priceCents: x.c.priceCents!,
  retailer: x.c.retailerName,
  url: x.c.url,
  pickup: x.c.melbournePickup,
  imageUrl: x.c.imageUrl,
});

type State = { parts: Partial<Record<BuildCategory, Scored | null>>; price: number; value: number };

/**
 * Part value inside a build. Unlike the For You score, this ignores per-category budgets — the build's
 * total budget is the real limit, so spare money can flow to the parts that matter (usually the GPU).
 * Tier fit still stops overkill (a tier above the target scores lower).
 */
export const partValue = (x: Scored) =>
  100 * (0.55 * x.breakdown.fit + 0.25 * x.breakdown.discount + 0.1 * x.breakdown.convenience + 0.1 * x.breakdown.stock);

/**
 * Pool = best parts by build value (quality) ∪ best by For You score (which favours staying within the
 * category budget), so the search has both stronger and cheaper options to trade between.
 */
function topBy(xs: Scored[], n: number) {
  const byValue = [...xs].sort((a, b) => partValue(b) - partValue(a)).slice(0, n);
  const byScore = [...xs].sort((a, b) => b.score - a.score).slice(0, Math.ceil(n / 2));
  return [...new Set([...byValue, ...byScore])];
}

/** Candidate pools per category: in-stock products whose compatibility facts are known. */
export function buildPools(scored: Scored[], s: Settings, budgets: Record<string, number>) {
  const live = scored.filter((x) => x.c.source === "product" && x.c.priceCents && x.breakdown.stock > 0 && x.c.specs?.relevant !== false);
  const of = (cat: string) => live.filter((x) => x.c.category === cat && x.c.priceCents! <= (budgets[cat] ?? Infinity) * 1.6);
  const size = s.requirements.size;
  const wantSmall = size === "compact" || size === "sff";

  // Only recognised graphics card models (excludes power bridges, cables, brackets listed under GPUs).
  const gpu = topBy(
    of("gpu").filter((x) => estimateTier("gpu", x.c.title) !== null && !/bracket|riser|water ?block|backplate|cable|bridge|adapter|support|holder/i.test(x.c.title)),
    14,
  );
  const cpu = topBy(of("cpu").filter((x) => cpuSocket(x.c)), 14);

  const boards = of("motherboard").filter((x) => {
    const ff = boardFormFactor(x.c);
    if (!boardSocket(x.c) || !boardRamType(x.c) || !ff) return false;
    if (s.requirements.wifi && boardHasWifi(x.c) !== true) return false;
    if (size === "sff" && ff !== "ITX") return false;
    if (size === "compact" && ff === "ATX") return false;
    return true;
  });
  // keep the best few per socket so every CPU platform has options
  const motherboard = ["AM5", "AM4", "LGA1851", "LGA1700"].flatMap((sock) => topBy(boards.filter((b) => boardSocket(b.c) === sock), 8));

  const minRam = s.budget.total >= 1500 || s.uses.dev || s.uses.editing || s.uses.ai ? 32 : 16;
  const rams = of("ram").filter((x) => ramTypeOf(x.c) && isDesktopRam(x.c) && (ramCapacityGb(x.c) ?? 0) >= minRam);
  const ram = ["DDR5", "DDR4"].flatMap((t) => topBy(rams.filter((r) => ramTypeOf(r.c) === t), 6));

  const psu = topBy(of("psu").filter((x) => psuWatts(x.c)), 16);
  const cases = topBy(
    of("case").filter((x) => {
      const sup = caseSupports(x.c);
      if (!sup || /panel|bracket|riser|stand|dust|filter|fan only|accessor/i.test(x.c.title)) return false;
      return wantSmall ? !sup.includes("ATX") : true;
    }),
    12,
  );
  const minSsd = s.budget.total >= 1200 ? 1000 : 500;
  const storage = topBy(of("storage").filter((x) => isInternalSsd(x.c) && (storageGb(x.c) ?? 0) >= minSsd), 6);
  const cooling = topBy(of("cooling").filter((x) => isCpuCooler(x.c)), 6);
  return { gpu, cpu, motherboard, ram, psu, case: cases, storage, cooling } satisfies Record<BuildCategory, Scored[]>;
}

/** Can `x` join this partial build? (checked in ORDER, so earlier parts are known) */
function compatible(cat: BuildCategory, x: Scored, st: State): boolean {
  const p = st.parts;
  switch (cat) {
    case "motherboard":
      return !p.cpu || boardSocket(x.c) === cpuSocket(p.cpu.c);
    case "ram":
      return !p.motherboard || ramTypeOf(x.c) === boardRamType(p.motherboard.c);
    case "psu":
      return !p.cpu || (psuWatts(x.c) ?? 0) >= requiredPsuWatts(p.cpu.c, p.gpu?.c ?? null);
    case "case": {
      const ff = p.motherboard ? boardFormFactor(p.motherboard.c) : null;
      return !ff || (caseSupports(x.c) ?? []).includes(ff);
    }
    default:
      return true;
  }
}

export function assemble(
  pools: Record<BuildCategory, Scored[]>,
  limitCents: number,
  owned: BuildCategory[],
): State | null {
  const cats = ORDER.filter((c) => !owned.includes(c));
  // cheapest possible remaining cost, for pruning (ignores compatibility → a lower bound)
  const cheapest = Object.fromEntries(cats.map((c) => [c, Math.min(...pools[c].map((x) => x.c.priceCents!), Infinity)])) as Record<
    BuildCategory,
    number
  >;
  let beam: State[] = [{ parts: {}, price: 0, value: 0 }];

  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i]!;
    const rest = cats.slice(i + 1).reduce((a, c) => a + (c === "cooling" ? 0 : cheapest[c]), 0);
    const next: State[] = [];
    for (const st of beam) {
      if (cat === "cooling" && st.parts.cpu && !cpuNeedsCooler(st.parts.cpu.c)) {
        next.push({ ...st, parts: { ...st.parts, cooling: null } });
        continue;
      }
      for (const x of pools[cat]) {
        if (!compatible(cat, x, st)) continue;
        const price = st.price + x.c.priceCents!;
        if (price + rest > limitCents) continue;
        next.push({ parts: { ...st.parts, [cat]: x }, price, value: st.value + partValue(x) * WEIGHT[cat] });
      }
    }
    if (!next.length) return null;
    next.sort((a, b) => b.value - a.value || a.price - b.price);
    beam = next.slice(0, BEAM);
  }
  return beam[0] ?? null;
}

function checksFor(st: State, s: Settings): string[] {
  const p = st.parts;
  const out: string[] = [];
  if (p.cpu && p.motherboard) out.push(`CPU and motherboard both use socket ${cpuSocket(p.cpu.c)}`);
  if (p.ram && p.motherboard) out.push(`${ramTypeOf(p.ram.c)} memory matches the motherboard`);
  if (p.psu && p.cpu) out.push(`${psuWatts(p.psu.c)} W power supply covers the ~${requiredPsuWatts(p.cpu.c, p.gpu?.c ?? null)} W recommended`);
  if (p.case && p.motherboard) out.push(`Case fits a ${boardFormFactor(p.motherboard.c)} motherboard`);
  if (p.cpu) out.push(p.cooling ? "CPU cooler added (none included with this CPU)" : "Stock cooler included with the CPU");
  if (s.requirements.wifi && p.motherboard) out.push("Motherboard has built-in Wi-Fi");
  return out;
}

function toBuild(st: State, label: Build["label"], limitCents: number, s: Settings, owned: BuildCategory[]): Build {
  const parts = ORDER.flatMap((c) => (st.parts[c] ? [toPart(st.parts[c]!, c)] : []));
  return { label, limitCents, totalCents: st.price, parts, checks: checksFor(st, s), owned };
}

/** Best compatible build under budget, plus a cheaper and a stretch alternative, extras and a prebuilt comparison. */
export function assembleBuilds(scored: Scored[], s: Settings, budgets: Record<string, number>): BuildResult {
  const notes: string[] = [];
  const owned = s.owned.categories.filter((c): c is BuildCategory => (ORDER as string[]).includes(c));

  // Extras the user asked for: best-scoring in-stock item of each kind.
  const live = scored.filter((x) => x.c.source === "product" && x.c.priceCents && x.breakdown.stock > 0 && x.breakdown.fit >= 0.35);
  const pick = (pred: (x: Scored) => boolean) => topBy(live.filter(pred), 1)[0];
  const extras: BuildPart[] = [];
  const wantsPeriph = (["keyboard", "mouse", "headset"] as const).filter((k) => s.extras[k]);
  if (s.extras.monitor) {
    const m = pick((x) => x.c.category === "monitor");
    if (m) extras.push(toPart(m, "monitor"));
  }
  for (const k of wantsPeriph) {
    const re = k === "keyboard" ? /keyboard/i : k === "mouse" ? /\bmouse\b|\bmice\b/i : /headset|headphone/i;
    const m = pick((x) => x.c.category === "peripheral" && (re.test(x.c.specs?.peripheral_type ?? "") || re.test(x.c.title)) && !/pad|mat|keycap|cable|wrist/i.test(x.c.title));
    if (m) extras.push(toPart(m, "peripheral"));
  }
  if (s.extras.windows) {
    const w = pick((x) => x.c.category === "software" && /windows/i.test(x.c.title));
    if (w) extras.push(toPart(w, "software"));
  }
  const extrasTotalCents = extras.reduce((a, e) => a + e.priceCents, 0);

  // The build gets the total budget minus what the extras actually cost.
  const budgetCents = Math.max(0, s.budget.total * 100 - extrasTotalCents);
  const builds: Build[] = [];
  if (s.mode !== "prebuilt") {
    const pools = buildPools(scored, s, budgets);
    for (const [cat, pool] of Object.entries(pools))
      if (!pool.length && !owned.includes(cat as BuildCategory) && cat !== "cooling") notes.push(`No in-stock ${cat} with known specs yet`);
    const bestSt = assemble(pools, budgetCents, owned);
    if (bestSt) {
      builds.push(toBuild(bestSt, "best", budgetCents, s, owned));
      // Cheaper: only worth showing if it saves at least 5% vs the best build.
      const cheapLimit = Math.round(Math.min(budgetCents * 0.85, bestSt.price * 0.95));
      const cheap = assemble(pools, cheapLimit, owned);
      if (cheap) builds.push(toBuild(cheap, "cheaper", cheapLimit, s, owned));
      // Stretch: only worth showing if it's genuinely better, not just pricier.
      const stretchLimit = Math.round(budgetCents * 1.1);
      const stretch = assemble(pools, stretchLimit, owned);
      const gpuAtLeastAsGood = (a: State, b: State) => !a.parts.gpu || !b.parts.gpu || partValue(a.parts.gpu) >= partValue(b.parts.gpu);
      if (stretch && stretch.value > bestSt.value * 1.04 && stretch.price > bestSt.price && gpuAtLeastAsGood(stretch, bestSt))
        builds.push(toBuild(stretch, "stretch", stretchLimit, s, owned));
    }
    if (!builds.length) notes.push("Couldn't fit a complete compatible build in the budget with current stock");
  }

  let prebuilt: BuildResult["prebuilt"] = null;
  if (s.mode !== "build") {
    const pb = pick((x) => x.c.category === "prebuilt" && x.c.priceCents! <= budgetCents);
    const best = builds.find((b) => b.label === "best");
    if (pb) prebuilt = { part: toPart(pb, "prebuilt"), diffCents: best ? pb.c.priceCents! - best.totalCents : 0 };
  }
  return { budgetCents, builds, extras, extrasTotalCents, prebuilt, notes };
}
