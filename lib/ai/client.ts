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
  geminiModel: "gemini-2.5-flash",
  groqModel: "openai/gpt-oss-120b",
  // Conservative daily request caps (below the free-tier limits) — adjust in .env if limits change.
  geminiDailyLimit: 200,
  groqDailyLimit: 800,
  timeoutMs: 90_000,
};

export function providersFromEnv(env: NodeJS.ProcessEnv = process.env): Provider[] {
  const out: Provider[] = [];
  if (env.GEMINI_API_KEY)
    out.push({
      name: "gemini",
      baseUrl: AI_DEFAULTS.geminiBaseUrl,
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || AI_DEFAULTS.geminiModel,
      dailyLimit: Number(env.GEMINI_DAILY_LIMIT) || AI_DEFAULTS.geminiDailyLimit,
    });
  if (env.GROQ_API_KEY)
    out.push({
      name: "groq",
      baseUrl: AI_DEFAULTS.groqBaseUrl,
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || AI_DEFAULTS.groqModel,
      dailyLimit: Number(env.GROQ_DAILY_LIMIT) || AI_DEFAULTS.groqDailyLimit,
    });
  return out;
}

export class AiUnavailableError extends Error {
  constructor(public readonly attempts: string[]) {
    super(`All AI providers failed: ${attempts.join(" | ")}`);
    this.name = "AiUnavailableError";
  }
}

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

export interface AiDeps {
  providers: Provider[];
  db?: SupabaseClient | null; // for usage tracking (optional)
  fetchImpl?: FetchImpl;
  log?: (msg: string) => void;
}

export interface ChatJsonResult<T> {
  data: T;
  provider: Provider["name"];
  model: string;
}

/** Strips ```json fences and finds the outermost JSON object. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("No JSON object in response");
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
      const res = await fetchImpl(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          response_format: { type: "json_object" },
          temperature: req.temperature ?? 0.1,
          max_tokens: req.maxTokens ?? 8000,
        }),
        signal: AbortSignal.timeout(AI_DEFAULTS.timeoutMs),
      });
      const body = await res.text();
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
