import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Minimal OpenAI-compatible chat client with provider fallback:
 * Gemini Flash first; on rate-limit / server error / bad JSON → Groq.
 */

export interface Provider {
  name: "gemini" | "groq";
  baseUrl: string;
  apiKey: string;
  model: string;
  dailyLimit: number;
}

export const AI_DEFAULTS = {
  geminiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  groqBaseUrl: "https://api.groq.com/openai/v1",
  // Comma-separated: tried in order. Flash first, Flash-Lite when Flash is overloaded.
  geminiModel: "gemini-3.8-flash,gemini-3.5-flash-lite",
  // Separate per-model rate limits on Groq, so a second model adds free capacity.
  groqModel: "openai/gpt-oss-120b,openai/gpt-oss-20b",
  // Conservative daily request caps (below the free-tier limits) — adjust in .env if limits change.
  geminiDailyLimit: 200,
  groqDailyLimit: 800,
  timeoutMs: 90_000,
};

export function providersFromEnv(env: NodeJS.ProcessEnv = process.env): Provider[] {
  const out: Provider[] = [];
  if (env.GEMINI_API_KEY)
    for (const model of (env.GEMINI_MODEL || AI_DEFAULTS.geminiModel).split(",").map((m) => m.trim()).filter(Boolean))
      out.push({
        name: "gemini",
        baseUrl: AI_DEFAULTS.geminiBaseUrl,
        apiKey: env.GEMINI_API_KEY,
        model,
        dailyLimit: Number(env.GEMINI_DAILY_LIMIT) || AI_DEFAULTS.geminiDailyLimit,
      });
  if (env.GROQ_API_KEY)
    for (const model of (env.GROQ_MODEL || AI_DEFAULTS.groqModel).split(",").map((m) => m.trim()).filter(Boolean))
      out.push({
        name: "groq",
        baseUrl: AI_DEFAULTS.groqBaseUrl,
        apiKey: env.GROQ_API_KEY,
        model,
        dailyLimit: Number(env.GROQ_DAILY_LIMIT) || AI_DEFAULTS.groqDailyLimit,
      });
  return out;
}

export class AiUnavailableError extends Error {
  /** True when every failure was temporary (rate limit / overload / timeout) — worth waiting and retrying. */
  public readonly temporary: boolean;
  constructor(public readonly attempts: string[]) {
    super(`All AI providers failed: ${attempts.join(" | ")}`);
    this.name = "AiUnavailableError";
    this.temporary =
      attempts.length > 0 && attempts.every((a) => /cooling down|HTTP 429|HTTP 503|HTTP 5\d\d|timeout|aborted|fetch failed/i.test(a));
  }
}

/** Earliest time any cooling-down model becomes available again (ms from now), or 0. */
export function msUntilAnyModelReady(): number {
  if (!cooldownUntil.size) return 0;
  return Math.max(0, Math.min(...cooldownUntil.values()) - Date.now());
}

/** Models that just returned 503/429 are skipped for a while (per process) to save quota and time. */
const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = { 429: 60_000, 503: 3 * 60_000 } as const; // per-minute limits reset quickly
export function resetAiCooldowns() {
  cooldownUntil.clear();
}

type FetchImpl =(url: string, init: RequestInit) => Promise<Response>;

export interface AiDeps {
  providers: Provider[];
  db?: SupabaseClient | null; // for usage tracking (optional)
  fetchImpl?: FetchImpl;
  log?: (msg: string) => void;
  /** Delay before the single retry on HTTP 503. Negative disables the retry (tests). */
  retryDelayMs?: number;
}

export interface ChatJsonResult<T> {
  data: T;
  provider: Provider["name"];
  model: string;
}

/** Strips ```json fences and finds the outermost JSON object; salvages truncated `{"x":[...` arrays. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        /* fall through to salvage */
      }
    }
    const salvaged = salvageTruncatedArray(t.slice(Math.max(0, start)));
    if (salvaged !== undefined) return salvaged;
    throw new Error("No JSON object in response");
  }
}

/**
 * For output cut off mid-way like `{"items":[{...},{...},{"i":7,"ca` — keeps every complete element
 * of the first array and closes the JSON. Returns undefined if nothing can be recovered.
 */
export function salvageTruncatedArray(t: string): unknown {
  let depth = 0;
  let inStr = false;
  let esc = false;
  let arrayDepth = -1;
  let lastCompleteEnd = -1;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") {
      depth++;
      if (ch === "[" && arrayDepth < 0) arrayDepth = depth;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (ch === "}" && arrayDepth > 0 && depth === arrayDepth) lastCompleteEnd = i; // closed an element of the array
    }
  }
  if (arrayDepth < 0 || lastCompleteEnd < 0) return undefined;
  // close the array, then every object that enclosed it
  try {
    return JSON.parse(t.slice(0, lastCompleteEnd + 1) + "]" + "}".repeat(arrayDepth - 1));
  } catch {
    return undefined;
  }
}

async function usageToday(db: SupabaseClient, provider: string): Promise<number> {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
  const { data } = await db.from("ai_usage").select("requests").eq("day", day).eq("provider", provider).maybeSingle();
  return data?.requests ?? 0;
}

async function bumpUsage(db: SupabaseClient, provider: string, ok: boolean, tokens: number) {
  await db.rpc("bump_ai_usage", { p_provider: provider, p_ok: ok, p_tokens: tokens });
}

/**
 * Sends a chat request expecting a JSON object; validates it with `schema`.
 * Falls back to the next provider on 429 / 5xx / timeout / invalid JSON / schema mismatch.
 */
export async function chatJson<S extends z.ZodTypeAny>(
  deps: AiDeps,
  req: { system: string; user: string; schema: S; maxTokens?: number; temperature?: number },
): Promise<ChatJsonResult<z.infer<S>>> {
  const fetchImpl = deps.fetchImpl ?? ((u, i) => fetch(u, i));
  const log = deps.log ?? (() => {});
  const attempts: string[] = [];
  if (!deps.providers.length) throw new AiUnavailableError(["no AI keys configured"]);

  for (const p of deps.providers) {
    const coolKey = `${p.name}:${p.model}`;
    if ((cooldownUntil.get(coolKey) ?? 0) > Date.now()) {
      attempts.push(`${coolKey}: cooling down after overload`);
      continue;
    }
    if (deps.db) {
      const used = await usageToday(deps.db, p.name).catch(() => 0);
      if (used >= p.dailyLimit) {
        attempts.push(`${p.name}: daily cap ${p.dailyLimit} reached`);
        continue;
      }
    }

    let ok = false;
    let tokens = 0;
    try {
      const send = () => fetchImpl(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          response_format: { type: "json_object" },
          // Limits hidden "thinking" tokens, which otherwise eat the output budget and per-minute limits.
          reasoning_effort: "low",
          temperature: req.temperature ?? 0.1,
          max_tokens: req.maxTokens ?? 8000,
        }),
        signal: AbortSignal.timeout(AI_DEFAULTS.timeoutMs),
      });
      let res = await send();
      // 503 "high demand" is usually momentary — one short retry before falling back.
      if (res.status === 503 && (deps.retryDelayMs ?? 4000) >= 0) {
        await res.text();
        await new Promise((r) => setTimeout(r, deps.retryDelayMs ?? 4000));
        res = await send();
      }
      const body = await res.text();
      if (res.status === 503 || res.status === 429) {
        // A 429 mentioning "quota" is a daily/free-tier quota, not a per-minute limit — back off much longer.
        const daily = res.status === 429 && /quota/i.test(body) && !/per minute|tokens per|requests per/i.test(body);
        cooldownUntil.set(coolKey, Date.now() + (daily ? 60 * 60_000 : COOLDOWN_MS[res.status]));
      }
      if (!res.ok) {
        attempts.push(`${p.name}: HTTP ${res.status} ${body.slice(0, 160).replace(/\s+/g, " ")}`);
        // 400/401/403/404 = our request/key problem; still try the other provider.
        continue;
      }
      const json = JSON.parse(body);
      tokens = json?.usage?.total_tokens ?? 0;
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const parsed = req.schema.safeParse(extractJson(content));
      if (!parsed.success) {
        attempts.push(`${p.name}: schema mismatch ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
        continue;
      }
      ok = true;
      return { data: parsed.data, provider: p.name, model: p.model };
    } catch (err) {
      attempts.push(`${p.name}: ${(err as Error).message}`);
    } finally {
      if (deps.db) await bumpUsage(deps.db, p.name, ok, tokens).catch(() => {});
      if (!ok) log(`AI ${p.name} failed: ${attempts[attempts.length - 1]}`);
    }
  }
  throw new AiUnavailableError(attempts);
}
