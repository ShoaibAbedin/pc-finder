/**
 * Fallback performance tiers (1–10, same scale as the AI's) for current GPUs/CPUs, used when a listing
 * hasn't been AI-parsed yet. Without this, unparsed parts got a neutral score and could beat parts the AI
 * had correctly rated below target (e.g. an overpriced RTX 3060 winning over newer cards).
 */
const GPU_TIERS: [RegExp, number][] = [
  [/5090/, 10], [/4090/, 10], [/5080/, 9], [/4080/, 9], [/7900\s?xtx/, 9],
  [/5070\s?ti/, 8], [/9070\s?xt/, 8], [/4070\s?ti/, 7], [/7900/, 8],
  [/5070/, 7], [/9070/, 7], [/4070/, 6], [/7800\s?xt/, 6],
  [/5060\s?ti.*16|16.*5060\s?ti/, 6], [/5060\s?ti/, 5], [/9060\s?xt.*16|16.*9060\s?xt/, 5.5], [/9060\s?xt/, 5], [/7700\s?xt/, 5], [/4060\s?ti/, 5],
  [/5060/, 4], [/b580/, 4], [/4060/, 4], [/7600/, 3.5],
  [/5050/, 3], [/b570/, 3], [/3060/, 3], [/6600/, 3], [/a7[57]0/, 3],
  [/3050/, 2], [/6500/, 1.5], [/1650|1030|710|730/, 1],
];

const CPU_TIERS: [RegExp, number][] = [
  [/9950x3d|9950x/, 10], [/9900x3d|9900x/, 9], [/9800x3d/, 9], [/7950x/, 9], [/285k/, 9], [/14900k/, 9],
  [/7800x3d/, 8], [/265k/, 8], [/14700k/, 8], [/7900x/, 8],
  [/9700x/, 7], [/7700x?\b/, 7], [/245k/, 7], [/14600k/, 7], [/5800x3d|5700x3d/, 6],
  [/9600x?\b/, 6], [/7600x?\b/, 6], [/14400f?|13400f?/, 6], [/ultra 5 225/, 5],
  [/7500f/, 5], [/8600g/, 5], [/12400f?/, 5], [/5700x?\b/, 5],
  [/5600x?\b/, 4], [/8500g/, 4], [/12100f?|13100f?/, 3], [/5500\b/, 3], [/8400f|8300g|5600g/, 3],
];

export function estimateTier(category: string, title: string): number | null {
  const t = title.toLowerCase();
  const table = category === "gpu" ? GPU_TIERS : category === "cpu" ? CPU_TIERS : null;
  if (!table) return null;
  for (const [re, tier] of table) if (re.test(t)) return tier;
  return null;
}

/** Monitor resolution from specs or title: "4K"/"UHD"/"2160" → 4k, "QHD"/"1440"/"2K" → 1440p, "FHD"/"1080" → 1080p. */
export function monitorResolution(resolutionSpec: string | null | undefined, title: string): "4k" | "1440p" | "1080p" | null {
  const s = `${resolutionSpec ?? ""} ${title}`.toLowerCase();
  if (/\b4k\b|uhd|2160|3840/.test(s)) return "4k";
  if (/qhd|1440|\b2k\b|2560|uwqhd|wqhd/.test(s)) return "1440p";
  if (/fhd|1080|1920/.test(s)) return "1080p";
  return null;
}
