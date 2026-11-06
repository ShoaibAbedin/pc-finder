import type { Candidate } from "../ranking/score";

/**
 * Compatibility facts for build assembly. Each helper reads the AI-parsed specs first and falls back to
 * the listing title, returning null when unknown (unknown parts are left out of builds — safe side).
 */

export type Socket = "AM5" | "AM4" | "LGA1851" | "LGA1700";
export type RamType = "DDR5" | "DDR4";
export type FormFactor = "ATX" | "mATX" | "ITX";

const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

function normSocket(s: string | null | undefined): Socket | null {
  const t = lc(s).replace(/\s|-/g, "");
  if (/am5/.test(t)) return "AM5";
  if (/am4/.test(t)) return "AM4";
  if (/1851/.test(t)) return "LGA1851";
  if (/1700/.test(t)) return "LGA1700";
  return null;
}

/** Chipset → socket (boards often only say "B650" in the title). */
const CHIPSET_SOCKET: [RegExp, Socket][] = [
  // optional suffix letter: B650M, B850-I, B760M-A …
  [/\b(x870e?|x670e?|b850|b840|b650e?|a620)[a-z]?\b/, "AM5"],
  [/\b(x570|b550|a520|b450|x470)[a-z]?\b/, "AM4"],
  [/\b(z890|b860|h810)[a-z]?\b/, "LGA1851"],
  [/\b(z790|b760|h770|h610|z690|b660|h670)[a-z]?\b/, "LGA1700"],
];

export function cpuSocket(c: Candidate): Socket | null {
  const fromSpec = normSocket(c.specs?.socket);
  if (fromSpec) return fromSpec;
  const t = lc(c.title);
  const fromTitle = normSocket(t.match(/\b(am5|am4|lga ?1851|lga ?1700|1851|1700)\b/)?.[0]);
  if (fromTitle) return fromTitle;
  const ryzen = t.match(/ryzen\s+\d\s+(\d)\d{3}/)?.[1];
  if (ryzen) return ryzen === "5" ? "AM4" : ["7", "8", "9"].includes(ryzen) ? "AM5" : null;
  if (/\bultra\s+\d\s+2\d{2}/.test(t)) return "LGA1851";
  if (/\bi[3579][- ]1[234]\d{3}/.test(t)) return "LGA1700";
  return null;
}

export function boardSocket(c: Candidate): Socket | null {
  const fromSpec = normSocket(c.specs?.socket);
  if (fromSpec) return fromSpec;
  const t = lc(c.title);
  const direct = normSocket(t.match(/\b(am5|am4|lga ?1851|lga ?1700)\b/)?.[0]);
  if (direct) return direct;
  for (const [re, s] of CHIPSET_SOCKET) if (re.test(t)) return s;
  return null;
}

export function ramTypeOf(c: Candidate): RamType | null {
  const s = lc(c.specs?.ram_type) || lc(c.title);
  if (/ddr5/.test(s)) return "DDR5";
  if (/ddr4/.test(s)) return "DDR4";
  return null;
}

/** Board RAM type: explicit, or implied by socket (AM5 / LGA1851 are DDR5-only, AM4 is DDR4-only). */
export function boardRamType(c: Candidate): RamType | null {
  const explicit = ramTypeOf(c);
  if (explicit) return explicit;
  const s = boardSocket(c);
  if (s === "AM5" || s === "LGA1851") return "DDR5";
  if (s === "AM4") return "DDR4";
  return null; // LGA1700 boards come in both — must be stated
}

export function boardFormFactor(c: Candidate): FormFactor | null {
  const s = `${lc(c.specs?.form_factor)} ${lc(c.title)}`;
  if (/mini[- ]?itx|\bitx\b/.test(s)) return "ITX";
  if (/micro[- ]?atx|\bm-?atx\b|\bmatx\b/.test(s)) return "mATX";
  if (/\be-?atx\b|\batx\b/.test(s)) return "ATX";
  return null;
}

/** Board sizes a case accepts. */
export function caseSupports(c: Candidate): FormFactor[] | null {
  const s = `${lc(c.specs?.form_factor)} ${lc(c.title)}`;
  const withoutMicro = s.replace(/micro[- ]?atx|\bm-?atx\b|\bmatx\b/g, " ");
  // Largest size mentioned wins: a full "ATX" (not Micro-ATX) or tower case fits everything.
  if (/mid[- ]?tower|full[- ]?tower|e-?atx/.test(s) || /\batx\b/.test(withoutMicro)) return ["ATX", "mATX", "ITX"];
  if (/micro[- ]?atx|\bm-?atx\b|\bmatx\b|micro tower|mini tower/.test(s)) return ["mATX", "ITX"];
  if (/mini[- ]?itx|\bitx\b|\bsff\b|small form/.test(s)) return ["ITX"];
  return null;
}

export function boardHasWifi(c: Candidate): boolean | null {
  if (c.specs?.wifi != null) return c.specs.wifi;
  if (/wi-?fi|wireless|\bwifi\b|\bax\b/i.test(c.title)) return true;
  return null;
}

export function psuWatts(c: Candidate): number | null {
  if (c.specs?.wattage) return c.specs.wattage;
  const m = c.title.match(/\b(\d{3,4})\s?w\b/i);
  return m ? Number(m[1]) : null;
}

export function ramCapacityGb(c: Candidate): number | null {
  if (c.specs?.capacity_gb) return c.specs.capacity_gb;
  const kit = c.title.match(/\b(\d{1,3})\s?gb\b/i);
  return kit ? Number(kit[1]) : null;
}

export function isDesktopRam(c: Candidate): boolean {
  return !/so-?dimm|laptop|notebook/i.test(c.title) && c.specs?.relevant !== false;
}

export function storageGb(c: Candidate): number | null {
  if (c.specs?.capacity_gb) return c.specs.capacity_gb;
  const tb = c.title.match(/\b(\d+(?:\.\d)?)\s?tb\b/i);
  if (tb) return Number(tb[1]) * 1000;
  const gb = c.title.match(/\b(\d{3,4})\s?gb\b/i);
  return gb ? Number(gb[1]) : null;
}

export function isInternalSsd(c: Candidate): boolean {
  const s = `${lc(c.specs?.storage_type)} ${lc(c.title)}`;
  return /nvme|m\.2|ssd/.test(s) && !/external|portable|enclosure|usb/.test(s);
}

export function isCpuCooler(c: Candidate): boolean {
  const s = `${lc(c.specs?.cooler_type)} ${lc(c.specs?.kind)} ${lc(c.title)}`;
  if (/case fan|fan pack|\b\dx\b fan|\b(3|5)[- ]?pack\b|thermal paste|pad|bracket|controller|hub|fittings|reservoir|tubing/.test(s)) return false;
  return /cpu cooler|air cooler|aio|liquid|water cool|tower cooler|cpu air|\b(240|280|360|420)\s?mm\b/.test(s);
}

/** Does the CPU need a separate cooler? Assume yes unless the listing says one is included. */
export function cpuNeedsCooler(c: Candidate): boolean {
  return !/wraith|laminar|with (stock )?cooler|cooler included|includes cooler/i.test(c.title);
}

/* ---------------- power ---------------- */

const GPU_WATTS: [RegExp, number][] = [
  [/5090/, 575], [/5080/, 360], [/5070\s?ti/, 300], [/5070/, 250], [/5060\s?ti/, 180], [/5060/, 145], [/5050/, 130],
  [/4090/, 450], [/4080/, 320], [/4070\s?ti/, 285], [/4070/, 200], [/4060\s?ti/, 165], [/4060/, 115],
  [/3060/, 170], [/3050/, 130],
  [/9070\s?xt/, 304], [/9070/, 220], [/9060\s?xt/, 160], [/7900/, 315], [/7800/, 263], [/7700/, 245], [/7600/, 165],
  [/b580/, 190], [/b570/, 150], [/a770/, 225], [/a750/, 225],
];

export function gpuWatts(c: Candidate): number {
  const s = `${lc(c.specs?.gpu_chip)} ${lc(c.specs?.model)} ${lc(c.title)}`;
  for (const [re, w] of GPU_WATTS) if (re.test(s)) return w;
  return (c.specs?.tier ?? 5) >= 7 ? 300 : 200;
}

export function cpuWatts(c: Candidate): number {
  const t = lc(c.title);
  if (/i9|ultra 9|ryzen 9/.test(t)) return 200;
  if (/\d{4,5}k|ultra \d 2\d{2}k/.test(t)) return 180;
  if (/x3d/.test(t)) return 120;
  return 105;
}

/** Recommended PSU size: (CPU + GPU + 100 W for the rest) × 1.3 headroom, rounded up to 50 W, min 550 W. */
export function requiredPsuWatts(cpu: Candidate, gpu: Candidate | null): number {
  const draw = cpuWatts(cpu) + (gpu ? gpuWatts(gpu) : 0) + 100;
  return Math.max(550, Math.ceil((draw * 1.3) / 50) * 50);
}
