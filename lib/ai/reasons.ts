import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { formatPrice } from "../format";
import { templateReason, type Scored } from "../ranking/score";
import { chatJson, type AiDeps } from "./client";

/**
 * AI job 4: a one-line "why this ranks high for you".
 * The AI only rephrases facts we computed from scraped data. Any dollar figure in its output that
 * isn't in the facts is rejected (falls back to a template), so the AI can never introduce a price.
 */

const ReasonsResponse = z.object({
  reasons: z.array(z.object({ k: z.string(), reason: z.string() })),
});

const SYSTEM = `You write one short line (max 110 characters) explaining why a PC deal suits the buyer.
Use ONLY the facts given. Do not add any numbers or prices that are not in the facts. No marketing fluff, no emojis.
Return ONLY JSON: {"reasons":[{"k": key, "reason": text}]}`;

export function factsFor(x: Scored): string {
  return [
    x.c.title.slice(0, 120),
    `price ${formatPrice(x.c.priceCents)} at ${x.c.retailerName ?? "OzBargain store"}`,
    ...x.breakdown.notes,
  ].join("; ");
}

const hash = (s: string) => createHash("md5").update(s).digest("hex");

/** True if every $ amount in `reason` appears in `facts`. */
export function reasonIsSafe(reason: string, facts: string): boolean {
  const amounts = reason.match(/\$\s?\d[\d,]*(\.\d+)?/g) ?? [];
  const norm = (a: string) => a.replace(/[\s,]/g, "");
  const factAmounts = new Set((facts.match(/\$\s?\d[\d,]*(\.\d+)?/g) ?? []).map(norm));
  return reason.length > 0 && reason.length <= 160 && amounts.every((a) => factAmounts.has(norm(a)));
}

export async function writeReasons(
  db: SupabaseClient,
  deps: AiDeps,
  items: Scored[],
  log: (m: string) => void = () => {},
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const facts = new Map(items.map((x) => [x.c.key, factsFor(x)]));
  const hashes = new Map(items.map((x) => [x.c.key, hash(facts.get(x.c.key)!)]));

  // cached
  const { data: cached } = await db
    .from("ai_reasons")
    .select("item_key, facts_hash, reason")
    .in(
      "item_key",
      items.map((x) => x.c.key),
    );
  for (const r of cached ?? []) if (hashes.get(r.item_key) === r.facts_hash) out.set(r.item_key, r.reason);

  const todo = items.filter((x) => !out.has(x.c.key));
  if (todo.length) {
    try {
      const res = await chatJson(deps, {
        system: SYSTEM,
        user: todo.map((x) => `${x.c.key} :: ${facts.get(x.c.key)}`).join("\n"),
        schema: ReasonsResponse,
        maxTokens: 4000,
        temperature: 0.4,
      });
      const rows = [];
      for (const r of res.data.reasons) {
        const f = facts.get(r.k);
        if (!f || out.has(r.k)) continue;
        const text = r.reason.trim().replace(/\s+/g, " ");
        if (!reasonIsSafe(text, f)) continue;
        out.set(r.k, text);
        rows.push({ item_key: r.k, facts_hash: hashes.get(r.k)!, reason: text, provider: res.provider, model: res.model });
      }
      if (rows.length) await db.from("ai_reasons").upsert(rows, { onConflict: "item_key,facts_hash" });
      log(`reasons: ${rows.length} written via ${res.provider}, ${items.length - todo.length} cached`);
    } catch (err) {
      log(`reasons: AI unavailable (${(err as Error).message.slice(0, 200)}) — using templates`);
    }
  }
  for (const x of items) if (!out.has(x.c.key)) out.set(x.c.key, templateReason(x));
  return out;
}
