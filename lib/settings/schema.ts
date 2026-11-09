import { z } from "zod";
import { BUILD_CATEGORIES } from "./constants";

export { BUILD_CATEGORIES, type BuildCategory } from "./constants";

const money = z.coerce.number().int().min(0).max(100_000);
const optMoney = z
  .preprocess((v) => (v === "" || v === null || v === 0 ? undefined : v), money.optional())
  .optional();
const brands = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean).slice(0, 20));

export const SettingsSchema = z.object({
  budget: z.object({
    total: money.refine((n) => n >= 200, "Budget must be at least $200"),
    perCategory: z
      .object({
        gpu: optMoney,
        cpu: optMoney,
        motherboard: optMoney,
        ram: optMoney,
        storage: optMoney,
        psu: optMoney,
        case: optMoney,
        cooling: optMoney,
        prebuilt: optMoney,
        monitor: optMoney,
        peripheral: optMoney,
        software: optMoney,
      })
      .default({} as never),
  }),
  uses: z.object({
    gaming: z.boolean().default(false),
    resolution: z.enum(["1080p", "1440p", "4k", "ultrawide"]).default("1440p"),
    gamingStyle: z.enum(["competitive", "balanced", "max-settings"]).default("balanced"),
    dev: z.boolean().default(false),
    editing: z.boolean().default(false),
    streaming: z.boolean().default(false),
    ai: z.boolean().default(false),
    office: z.boolean().default(false),
    notes: z.string().max(500).default(""),
  }),
  requirements: z.object({
    preferredBrands: brands.default([]),
    avoidBrands: brands.default([]),
    mustHave: z.string().max(500).default(""),
    size: z.enum(["any", "full", "mid", "compact", "sff"]).default("any"),
    colour: z.enum(["any", "black", "white"]).default("any"),
    quiet: z.boolean().default(false),
    wifi: z.boolean().default(false),
    rgb: z.enum(["any", "yes", "no"]).default("any"),
  }),
  mode: z.enum(["build", "prebuilt", "both"]).default("both"),
  owned: z.object({
    categories: z.array(z.enum(BUILD_CATEGORIES)).default([]),
    notes: z.string().max(500).default(""),
  }),
  extras: z.object({
    monitor: z.boolean().default(false),
    keyboard: z.boolean().default(false),
    mouse: z.boolean().default(false),
    headset: z.boolean().default(false),
    windows: z.boolean().default(false),
  }),
  location: z.object({
    suburb: z.string().max(80).default(""),
    postcode: z
      .string()
      .regex(/^(\d{4})?$/, "Postcode must be 4 digits")
      .default(""),
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;

/** Stable hash of settings — when it changes, AI build targets are regenerated. */
export function settingsHash(s: Settings): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .filter(([, x]) => x !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, stable(x)]),
          )
        : v;
  // cyrb53 — small, dependency-free string hash (isomorphic; not for security)
  const str = JSON.stringify(stable(s));
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** Categories the user actually shops in (used to focus AI parsing and alerts). */
export function wantedCategories(s: Settings): string[] {
  const out: string[] = [];
  if (s.mode !== "prebuilt") out.push(...BUILD_CATEGORIES.filter((c) => !s.owned.categories.includes(c)));
  if (s.mode !== "build") out.push("prebuilt");
  if (s.extras.monitor) out.push("monitor");
  if (s.extras.keyboard || s.extras.mouse || s.extras.headset) out.push("peripheral");
  if (s.extras.windows) out.push("software");
  return out;
}

/** Victoria postcodes 3000–3999 / 8000–8999 → Melbourne-area click & collect is relevant. */
export function isVictoria(s: Settings): boolean {
  const pc = s.location.postcode;
  if (pc) return /^[38]\d{3}$/.test(pc);
  return true; // user said they're in Melbourne; default to yes
}

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({
  budget: { total: 2500 },
  uses: { gaming: true },
  requirements: {},
  owned: {},
  extras: {},
  location: { suburb: "Melbourne" },
});
