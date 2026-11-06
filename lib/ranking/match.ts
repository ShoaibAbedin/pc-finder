/**
 * Recognises the same product listed at different stores by comparing title "fingerprints"
 * (significant words + model numbers), within the same category and brand.
 */
const STOP = new Set([
  "graphics", "card", "video", "gaming", "edition", "the", "with", "and", "for", "new", "pc", "desktop",
  "processor", "cpu", "motherboard", "memory", "kit", "ram", "drive", "ssd", "internal", "power", "supply",
  "psu", "case", "cooler", "monitor", "keyboard", "mouse", "headset", "black", "boxed", "retail", "oem",
  "nvidia", "geforce", "amd", "radeon", "intel", "core", "ryzen",
]);

const cache = new Map<string, Set<string>>();

export function fingerprint(title: string): Set<string> {
  const hit = cache.get(title);
  if (hit) return hit;
  if (cache.size > 50_000) cache.clear();
  const fp = computeFingerprint(title);
  cache.set(title, fp);
  return fp;
}

function computeFingerprint(title: string): Set<string> {
  const tokens = title
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/(\d)\s+(gb|tb|hz|w|mhz)\b/g, "$1$2") // "16 GB" → "16gb"
    .replace(/\b(\d+)g\b/g, "$1gb") // "16G" → "16gb"
    .replace(/\b(\d+)t\b/g, "$1tb")
    .split(/[^a-z0-9]+/)
    .filter((t) => (t.length > 1 || VARIANTS.has(t)) && !STOP.has(t));
  return new Set(tokens);
}

export function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Words that turn one model into a different one (RTX 5070 vs 5070 Ti, 7800X vs 7800X3D…). */
const VARIANTS = new Set(["ti", "super", "xt", "xtx", "gre", "x3d", "ks", "kf", "k", "f", "x", "pro", "plus", "max", "mini", "lite"]);

/** Tokens starting with a digit identify the model/capacity: 5070, 850w, 16gb, 9800x3d, 2tb. */
const keyNumbers = (s: Set<string>) => new Set([...s].filter((t) => /^\d/.test(t) && t !== "80"));
const variants = (s: Set<string>) => [...s].filter((t) => VARIANTS.has(t)).sort().join(",");
const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));

export function sameProduct(a: { title: string; category: string }, b: { title: string; category: string }): boolean {
  if (a.category !== b.category) return false;
  const brandA = a.title.split(/\s+/)[0]!.toLowerCase();
  const brandB = b.title.split(/\s+/)[0]!.toLowerCase();
  if (brandA !== brandB) return false;
  const fa = fingerprint(a.title);
  const fb = fingerprint(b.title);
  if (variants(fa) !== variants(fb)) return false;
  const na = keyNumbers(fa);
  const nb = keyNumbers(fb);
  if (!na.size && !nb.size) return similarity(fa, fb) >= 0.9 && fa.size >= 3; // no model numbers: near-identical only
  if (!na.size || !nb.size) return false;
  const [small, big] = na.size <= nb.size ? [na, nb] : [nb, na];
  return isSubset(small, big) && similarity(fa, fb) >= 0.5;
}
