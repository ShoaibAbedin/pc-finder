import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CATEGORIES } from "../../scrapers/core/types";
import { AiUnavailableError, chatJson, msUntilAnyModelReady, type AiDeps } from "./client";

/* ---------- schema ---------- */

const num = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}, z.number().nullable()).catch(null);
// Lenient: wrong-typed fields become null instead of rejecting the whole item.
const str = z
  .preprocess(
    (v) => (v === undefined || v === "" ? null : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "yes" : "no") : v),
    z.string().max(120).nullable(),
  )
  .catch(null);
const bool = z
  .preprocess((v) => (v === undefined ? null : v === "yes" || v === "true" ? true : v === "no" || v === "false" ? false : v), z.boolean().nullable())
  .catch(null);

/**
 * Structured specs for one listing. Every field is optional (null when not applicable/unknown).
 * NOTE: no price fields on purpose — prices only ever come from scraped data.
 */
export const SpecSchema = z.object({
  i: z.number().int(),
  category: z.enum(CATEGORIES).catch("other"),
  relevant: z.boolean().catch(true), // false = not a desktop PC part/prebuilt/monitor/peripheral/Windows licence
  kind: str, // subtype, e.g. "graphics card", "laptop RAM", "case fan", "gaming PC"
  brand: str,
  model: str, // normalised model, e.g. "RTX 5070 Ti", "Ryzen 7 9800X3D"
  tier: num, // 1–10 performance tier within its category for gaming/workloads
  gpu_chip: str,
  vram_gb: num,
  cpu_model: str,
  socket: str, // AM5, AM4, LGA1851, LGA1700
  cores: num,
  igpu: bool,
  chipset: str, // motherboard chipset e.g. B650, Z890
  form_factor: str, // ATX, mATX, ITX, E-ATX (boards/cases/PSUs: ATX/SFX)
  ram_type: str, // DDR4 / DDR5
  capacity_gb: num, // RAM kit total or storage capacity
  modules: num,
  speed_mts: num,
  storage_type: str, // NVMe, SATA SSD, HDD, external
  pcie_gen: num,
  wattage: num,
  efficiency: str, // 80+ Gold etc.
  modular: str,
  cooler_type: str, // air, AIO, fan
  radiator_mm: num,
  max_gpu_mm: num,
  screen_in: num,
  resolution: str, // 1080p, 1440p, 4K, ultrawide 1440p
  refresh_hz: num,
  panel: str, // IPS, VA, OLED, TN
  peripheral_type: str, // keyboard, mouse, headset, other
  wireless: bool,
  wifi: bool,
  colour: str,
  rgb: bool,
  quiet: bool,
  // prebuilt components
  pb_cpu: str,
  pb_gpu: str,
  pb_ram_gb: num,
  pb_storage_gb: num,
  pb_psu_w: num,
  pb_os: str,
});
export type Specs = z.infer<typeof SpecSchema>;

const BatchResponse = z.object({ items: z.array(z.unknown()) });

const SYSTEM = `You extract structured specifications from Australian PC retail listing titles.
Return ONLY a JSON object: {"items":[...]} with one entry per input line, each with "i" equal to the input index.
Fields — OMIT any field that is unknown or not applicable (never output nulls), and never invent values not implied by the title:
category (one of ${CATEGORIES.join(", ")}), relevant (false if not a desktop PC component/prebuilt desktop/monitor/keyboard/mouse/headset/Windows licence — e.g. laptop RAM, laptops, cables, mounts, gift cards, warranties, accessories),
kind, brand, model (normalised, e.g. "RTX 5070 Ti", "Ryzen 7 9800X3D", "B850"),
tier (integer 1-10 = performance tier WITHIN its category for current-gen gaming/workloads; 10 = flagship, e.g. RTX 5090=10, RTX 5070=6, RTX 5060=4; Ryzen 7 9800X3D=9; 32GB DDR5-6000=7; 1TB Gen4 NVMe=6; 850W Gold=7),
gpu_chip, vram_gb, cpu_model, socket (AM5/AM4/LGA1851/LGA1700), cores, igpu, chipset, form_factor (ATX/mATX/ITX/E-ATX/SFX),
ram_type (DDR4/DDR5), capacity_gb (RAM kit total or storage size in GB), modules, speed_mts, storage_type (NVMe/SATA SSD/HDD/external), pcie_gen,
wattage, efficiency, modular, cooler_type (air/AIO/fan), radiator_mm, max_gpu_mm, screen_in, resolution (1080p/1440p/4K/ultrawide 1440p/ultrawide 4K), refresh_hz, panel,
peripheral_type (keyboard/mouse/headset/other), wireless, wifi, colour (black/white/other), rgb, quiet,
pb_cpu, pb_gpu, pb_ram_gb, pb_storage_gb, pb_psu_w, pb_os (for prebuilt desktops only).
Never output prices, costs or discounts.`;

/* ---------- helpers ---------- */

export const titleHash = (category: string, title: string) =>
  createHash("md5").update(`${category}|${title}`).digest("hex");

export interface SpecInput {
  hash: string;
  category: string;
  title: string;
}

/** Validates each returned item separately so one bad item doesn't discard the batch. */
export function validateItems(raw: unknown[], batch: SpecInput[]): Map<string, Specs> {
  const out = new Map<string, Specs>();
  for (const r of raw) {
    const p = SpecSchema.safeParse(r);
    if (!p.success) continue;
    const input = batch[p.data.i];
    if (input && !out.has(input.hash)) out.set(input.hash, p.data);
  }
  return out;
}

export async function parseSpecsBatch(deps: AiDeps, batch: SpecInput[]) {
  const user = batch.map((b, i) => `${i}\t[${b.category}]\t${b.title}`).join("\n");
  const res = await chatJson(deps, {
    system: SYSTEM,
    user: `Listings (index<TAB>[scraper category hint]<TAB>title):\n${user}`,
    schema: BatchResponse,
    // ~200 output tokens per item. Groq's free tier counts prompt + max_tokens against an ~8k tokens/minute
    // allowance up front, so keep the whole request well under that (25 items ≈ 1.5k prompt + 5k output incl. reasoning).
    maxTokens: Math.min(16_000, 700 + batch.length * 170),
  });
  return { specs: validateItems(res.data.items, batch), provider: res.provider, model: res.model };
}

/* ---------- job runner ---------- */

const PAGE = 1000; // Supabase returns max 1000 rows per request

/** Collects unique (category,title) pairs from live listings that have no cached specs yet. */
async function pendingInputs(db: SupabaseClient, limit: number, categories?: string[]): Promise<SpecInput[]> {
  const cached = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("spec_cache").select("title_hash").range(from, from + PAGE - 1);
    if (error) throw new Error(`spec_cache: ${error.message}`);
    data.forEach((r) => cached.add(r.title_hash));
    if (data.length < PAGE) break;
  }

  const pending = new Map<string, SpecInput>();
  // Only what can matter to the user: in-stock items (then OzBargain) in categories they buy from.
  // Out-of-stock items are parsed later only if they come back in stock.
  const inCats = (q: any) => (categories?.length ? q.in("category", categories) : q);
  const sources: { table: string; filter: (q: any) => any }[] = [
    { table: "products", filter: (q) => inCats(q.eq("status", "active")) },
    { table: "ozbargain_deals", filter: (q) => inCats(q.eq("status", "active").neq("category", "other")) },
  ];
  for (const s of sources) {
    for (let from = 0; pending.size < limit; from += PAGE) {
      const { data, error } = await s
        .filter(db.from(s.table).select("title_hash, category, title"))
        .order("title_hash")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${s.table}: ${error.message}`);
      for (const r of data as { title_hash: string; category: string; title: string }[]) {
        if (!cached.has(r.title_hash) && !pending.has(r.title_hash))
          pending.set(r.title_hash, { hash: r.title_hash, category: r.category, title: r.title });
        if (pending.size >= limit) break;
      }
      if (data.length < PAGE) break;
    }
  }
  return [...pending.values()];
}

export async function runSpecParsing(
  db: SupabaseClient,
  deps: AiDeps,
  opts: {
    maxBatches: number;
    batchSize?: number;
    log?: (m: string) => void;
    /** Stop starting new batches after this long (default 25 min). */
    timeBudgetMs?: number;
    /** Minimum gap between batches, to respect free-tier requests-per-minute (default 5 s). */
    minGapMs?: number;
    sleep?: (ms: number) => Promise<void>;
    /** Only parse these categories (from the user's settings). */
    categories?: string[];
  },
): Promise<{ parsed: number; pending: number; failedBatches: number; stoppedEarly: boolean }> {
  const log = opts.log ?? (() => {});
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const size = opts.batchSize ?? 25;
  const deadline = Date.now() + (opts.timeBudgetMs ?? 25 * 60_000);
  const minGap = opts.minGapMs ?? 5_000;
  const inputs = await pendingInputs(db, opts.maxBatches * size, opts.categories);
  log(`spec parsing: ${inputs.length} unique titles pending (this run's cap ${opts.maxBatches * size})`);

  let parsed = 0;
  let failedBatches = 0;
  let stoppedEarly = false;
  let waits = 0;
  let consecutiveFails = 0;
  for (let i = 0; i < inputs.length; i += size) {
    if (Date.now() > deadline) {
      log("  time budget used up — remaining titles will be parsed next run");
      stoppedEarly = true;
      break;
    }
    const batch = inputs.slice(i, i + size);
    if (i > 0) await sleep(minGap);
    try {
      const { specs, provider, model } = await parseSpecsBatch(deps, batch);
      const rows = batch
        .filter((b) => specs.has(b.hash))
        .map((b) => ({ title_hash: b.hash, category: b.category, title: b.title, specs: specs.get(b.hash), provider, model }));
      if (rows.length) {
        const { error } = await db.from("spec_cache").upsert(rows, { onConflict: "title_hash" });
        if (error) throw new Error(`save specs: ${error.message}`);
      }
      parsed += rows.length;
      waits = 0;
      log(`  batch ${i / size + 1}: ${rows.length}/${batch.length} parsed via ${provider}/${model}`);
    } catch (err) {
      if (err instanceof AiUnavailableError && err.temporary && waits < 6 && Date.now() < deadline) {
        // Per-minute limits / overload: wait for a model to free up, then retry the same batch.
        const wait = Math.max(30_000, Math.min(msUntilAnyModelReady(), 120_000));
        waits++;
        log(`  batch ${i / size + 1}: all models busy/rate-limited — waiting ${Math.round(wait / 1000)}s (${waits}/6)`);
        await sleep(wait);
        i -= size; // retry this batch
        continue;
      }
      failedBatches++;
      consecutiveFails++;
      log(`  batch ${i / size + 1} failed (skipped, retried next run): ${(err as Error).message.slice(0, 300)}`);
      // Stop only when it's hopeless (daily caps / bad keys) or failing repeatedly; otherwise skip this batch.
      const hopeless =
        err instanceof AiUnavailableError && err.attempts.every((a) => /daily cap|HTTP 401|HTTP 403|no AI keys/i.test(a));
      if (hopeless || consecutiveFails >= 5) {
        stoppedEarly = true;
        break;
      }
      continue;
    }
    consecutiveFails = 0;
  }
  return { parsed, pending: inputs.length - parsed, failedBatches, stoppedEarly };
}

/** Loads cached specs for a set of title hashes. */
export async function loadSpecs(db: SupabaseClient, hashes: string[]): Promise<Map<string, Specs>> {
  const out = new Map<string, Specs>();
  const uniq = [...new Set(hashes)];
  for (let i = 0; i < uniq.length; i += 200) {
    const { data, error } = await db
      .from("spec_cache")
      .select("title_hash, specs")
      .in("title_hash", uniq.slice(i, i + 200));
    if (error) throw new Error(`loadSpecs: ${error.message}`);
    for (const r of data) out.set(r.title_hash, r.specs as Specs);
  }
  return out;
}
