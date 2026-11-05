import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BUILD_CATEGORIES, settingsHash, type Settings } from "../settings/schema";
import { chatJson, type AiDeps } from "./client";

const CatTarget = z.object({
  min_tier: z.coerce.number().min(1).max(10),
  ideal_tier: z.coerce.number().min(1).max(10),
  prefer: z.array(z.string()).max(12).catch([]), // keywords/models to favour, e.g. "RTX 5070", "DDR5", "B850"
  avoid: z.array(z.string()).max(12).catch([]),
  notes: z.string().max(200).catch(""),
});

/** Budget split is percentages (AI never sees or produces dollar prices for products). */
export const TargetsSchema = z.object({
  summary: z.string().max(400),
  budget_split_pct: z.record(z.string(), z.coerce.number().min(0).max(100)),
  platform: z
    .object({
      socket: z.string().nullable().catch(null), // AM5 / LGA1851 / null = either
      ram_type: z.string().nullable().catch("DDR5"),
      min_psu_w: z.coerce.number().nullable().catch(null),
      form_factor: z.string().nullable().catch(null),
    })
    .catch({ socket: null, ram_type: "DDR5", min_psu_w: null, form_factor: null }),
  targets: z.record(z.string(), CatTarget),
  monitor: z
    .object({ resolution: z.string().nullable(), min_refresh_hz: z.coerce.number().nullable(), size_in: z.coerce.number().nullable() })
    .nullable()
    .catch(null),
});
export type Targets = z.infer<typeof TargetsSchema>;

const SYSTEM = `You are a PC building advisor for an Australian buyer. Given their requirements, output target component TIERS (not prices).
Return ONLY JSON:
{"summary": one or two sentences,
 "budget_split_pct": {category: percent of total budget} for the categories they need (build parts ${BUILD_CATEGORIES.join(", ")}; plus "prebuilt" if they consider prebuilts; plus monitor/peripheral/software if requested). Exclude owned parts. Percentages for build parts + extras should sum to ~100. If they want "both", give prebuilt the same share as the sum of build parts.
 "platform": {"socket": "AM5"|"LGA1851"|null, "ram_type": "DDR5"|"DDR4", "min_psu_w": number, "form_factor": "ATX"|"mATX"|"ITX"|null},
 "targets": {category: {"min_tier":1-10, "ideal_tier":1-10, "prefer":[model/keyword strings], "avoid":[strings], "notes": short}} for every needed category including prebuilt/monitor/peripheral/software when relevant,
 "monitor": {"resolution", "min_refresh_hz", "size_in"} or null}
Tier scale is 1-10 within each category (10 = flagship; e.g. GPU RTX 5090=10, RTX 5080=9, RTX 5070 Ti=8, RTX 5070/RX 9070=6-7, RTX 5060 Ti=5, RTX 5060=4).
Be realistic for the total budget in AUD. Never output product prices.`;

function describe(s: Settings): string {
  const lines = [
    `Total budget: AUD ${s.budget.total}`,
    `Per-category limits (AUD): ${JSON.stringify(s.budget.perCategory)}`,
    `Uses: ${Object.entries(s.uses)
      .filter(([k, v]) => v === true && k !== "notes")
      .map(([k]) => k)
      .join(", ") || "general"}`,
    s.uses.gaming ? `Gaming at ${s.uses.resolution}, style ${s.uses.gamingStyle}` : "",
    s.uses.notes ? `Use notes: ${s.uses.notes}` : "",
    `Mode: ${s.mode} (build = own parts, prebuilt, or both)`,
    `Preferred brands: ${s.requirements.preferredBrands.join(", ") || "none"}; avoid: ${s.requirements.avoidBrands.join(", ") || "none"}`,
    `Must have: ${s.requirements.mustHave || "nothing specific"}`,
    `Size: ${s.requirements.size}; colour: ${s.requirements.colour}; quiet: ${s.requirements.quiet}; Wi-Fi: ${s.requirements.wifi}; RGB: ${s.requirements.rgb}`,
    `Already owns: ${s.owned.categories.join(", ") || "nothing"} ${s.owned.notes}`,
    `Also wants: ${Object.entries(s.extras)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ") || "nothing extra"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export async function generateTargets(deps: AiDeps, s: Settings) {
  return chatJson(deps, { system: SYSTEM, user: describe(s), schema: TargetsSchema, maxTokens: 4000, temperature: 0.2 });
}

export async function loadTargets(db: SupabaseClient): Promise<{ hash: string; data: Targets } | null> {
  const { data } = await db.from("build_targets").select("settings_hash, data").eq("id", 1).maybeSingle();
  if (!data) return null;
  const p = TargetsSchema.safeParse(data.data);
  return p.success ? { hash: data.settings_hash, data: p.data } : null;
}

/** Regenerates targets only if settings changed since last time. */
export async function ensureTargets(
  db: SupabaseClient,
  deps: AiDeps,
  s: Settings,
  log: (m: string) => void = () => {},
): Promise<Targets> {
  const hash = settingsHash(s);
  const existing = await loadTargets(db);
  if (existing?.hash === hash) return existing.data;
  log("settings changed → generating new build targets");
  const res = await generateTargets(deps, s);
  const { error } = await db
    .from("build_targets")
    .upsert({ id: 1, settings_hash: hash, data: res.data, provider: res.provider, model: res.model, created_at: new Date().toISOString() });
  if (error) throw new Error(`save targets: ${error.message}`);
  return res.data;
}
