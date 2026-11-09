import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AiUnavailableError, chatJson, extractJson, providersFromEnv, resetAiCooldowns, type Provider } from "../lib/ai/client";

beforeEach(() => resetAiCooldowns());
import { reasonIsSafe } from "../lib/ai/reasons";
import { validateItems } from "../lib/ai/specs";

const providers: Provider[] = [
  { name: "gemini", baseUrl: "https://gemini.test", apiKey: "g", model: "gm", dailyLimit: 10 },
  { name: "groq", baseUrl: "https://groq.test", apiKey: "q", model: "qm", dailyLimit: 10 },
];
const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 5 } }), { status: 200 });
const Schema = z.object({ answer: z.number() });

describe("chatJson provider fallback", () => {
  it("uses Gemini when it works", async () => {
    const calls: string[] = [];
    const r = await chatJson(
      { providers, fetchImpl: async (u) => (calls.push(u), ok('{"answer":1}')) },
      { system: "s", user: "u", schema: Schema },
    );
    expect(r).toMatchObject({ provider: "gemini", data: { answer: 1 } });
    expect(calls).toEqual(["https://gemini.test/chat/completions"]);
  });

  it("falls back to Groq on 429 rate limit", async () => {
    const r = await chatJson(
      {
        providers,
        fetchImpl: async (u) => (u.includes("gemini") ? new Response("quota", { status: 429 }) : ok('{"answer":2}')),
      },
      { system: "s", user: "u", schema: Schema },
    );
    expect(r).toMatchObject({ provider: "groq", data: { answer: 2 } });
  });

  it("falls back when Gemini returns JSON that fails the schema", async () => {
    const r = await chatJson(
      { providers, fetchImpl: async (u) => (u.includes("gemini") ? ok('{"answer":"nope"}') : ok("```json\n{\"answer\":3}\n```")) },
      { system: "s", user: "u", schema: Schema },
    );
    expect(r.data.answer).toBe(3);
  });

  it("retries a 503 once, then skips the overloaded model on later calls", async () => {
    const calls: string[] = [];
    const deps = {
      providers,
      retryDelayMs: 0,
      fetchImpl: async (u: string) => (calls.push(u), u.includes("gemini") ? new Response("busy", { status: 503 }) : ok('{"answer":4}')),
    };
    await chatJson(deps, { system: "s", user: "u", schema: Schema });
    expect(calls.filter((c) => c.includes("gemini"))).toHaveLength(2); // original + 1 retry
    calls.length = 0;
    const r = await chatJson(deps, { system: "s", user: "u", schema: Schema });
    expect(r.provider).toBe("groq");
    expect(calls.some((c) => c.includes("gemini"))).toBe(false); // cooling down
  });

  it("throws AiUnavailableError when everything fails", async () => {
    await expect(
      chatJson({ providers, retryDelayMs: 0, fetchImpl: async () => new Response("down", { status: 503 }) }, { system: "s", user: "u", schema: Schema }),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("sends an OpenAI-compatible JSON-mode request with the key", async () => {
    let body: any, auth = "";
    await chatJson(
      {
        providers: [providers[0]!],
        fetchImpl: async (_u, init) => {
          body = JSON.parse(String(init.body));
          auth = (init.headers as Record<string, string>).Authorization!;
          return ok('{"answer":1}');
        },
      },
      { system: "sys", user: "usr", schema: Schema },
    );
    expect(body.model).toBe("gm");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages.map((m: any) => m.role)).toEqual(["system", "user"]);
    expect(auth).toBe("Bearer g");
  });

  it("reads providers from env (Gemini first)", () => {
    const p = providersFromEnv({ GROQ_API_KEY: "q", GEMINI_API_KEY: "g" } as any);
    expect(p.map((x) => `${x.name}:${x.model}`)).toEqual(["gemini:gemini-3.5-flash-lite", "gemini:gemini-3.8-flash", "groq:openai/gpt-oss-120b", "groq:openai/gpt-oss-20b"]);
    expect(providersFromEnv({} as any)).toEqual([]);
  });
});

describe("extractJson", () => {
  it("handles fences and surrounding text", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":2} hope that helps')).toEqual({ a: 2 });
  });
});

describe("spec validation", () => {
  const batch = [
    { hash: "h0", category: "gpu", title: "RTX 5070" },
    { hash: "h1", category: "ram", title: "32GB DDR5" },
  ];
  it("keeps valid items, drops broken ones, and strips any price fields", () => {
    const out = validateItems(
      [
        { i: 0, category: "gpu", relevant: true, model: "RTX 5070", tier: "6", vram_gb: "12GB", price: 999, price_cents: 99900 },
        { i: 1, category: "ram", tier: { bad: true }, modular: true }, // bad field → nulled, item kept
        { i: 7, category: "gpu" }, // index out of range → ignored
      ],
      batch,
    );
    expect([...out.keys()]).toEqual(["h0", "h1"]);
    expect(out.get("h1")!.tier).toBeNull();
    expect(out.get("h1")!.modular).toBe("yes");
    const s = out.get("h0")!;
    expect(s.tier).toBe(6);
    expect(s.vram_gb).toBe(12);
    expect(s).not.toHaveProperty("price");
    expect(s).not.toHaveProperty("price_cents");
  });
  it("coerces unknown categories to other", () => {
    expect(validateItems([{ i: 0, category: "toaster" }], batch).get("h0")!.category).toBe("other");
  });
});

describe("reasonIsSafe (AI can't introduce prices)", () => {
  const facts = "RTX 5070; price $899 at Scorptec; within your $900 gpu budget";
  it("accepts reasons that only use given amounts", () => {
    expect(reasonIsSafe("Fits your $900 GPU budget at $899", facts)).toBe(true);
    expect(reasonIsSafe("Right tier for 1440p gaming", facts)).toBe(true);
  });
  it("rejects invented dollar figures and over-long text", () => {
    expect(reasonIsSafe("Was $1,099, now $899", facts)).toBe(false);
    expect(reasonIsSafe("x".repeat(200), facts)).toBe(false);
  });
});

describe("AiUnavailableError.temporary", () => {
  it("is temporary only when every failure is a rate limit / overload", () => {
    expect(new AiUnavailableError(["gemini: HTTP 503 busy", "groq: HTTP 429 rate"]).temporary).toBe(true);
    expect(new AiUnavailableError(["gemini:x: cooling down after overload"]).temporary).toBe(true);
    expect(new AiUnavailableError(["gemini: daily cap 200 reached", "groq: HTTP 429"]).temporary).toBe(false);
    expect(new AiUnavailableError(["groq: HTTP 401 bad key"]).temporary).toBe(false);
  });
});

describe("truncated output salvage", () => {
  it("keeps complete items from a cut-off response", () => {
    const cut = '{"items":[{"i":0,"model":"RTX 5070"},{"i":1,"model":"B650 {x}"},{"i":2,"mod';
    expect(extractJson(cut)).toEqual({ items: [{ i: 0, model: "RTX 5070" }, { i: 1, model: "B650 {x}" }] });
  });
  it("returns nothing useful when no item completed", () => {
    expect(() => extractJson('{"items":[{"i":0,"mo')).toThrow();
  });
});

describe("daily quota vs per-minute limit", () => {
  it("backs off a model for an hour on a daily quota 429, but retries others", async () => {
    const calls: string[] = [];
    const deps = {
      providers,
      fetchImpl: async (u: string) => (
        calls.push(u),
        u.includes("gemini") ? new Response("You exceeded your current quota, check your plan", { status: 429 }) : ok('{"answer":5}')
      ),
    };
    expect((await chatJson(deps, { system: "s", user: "u", schema: Schema })).provider).toBe("groq");
    calls.length = 0;
    await chatJson(deps, { system: "s", user: "u", schema: Schema });
    expect(calls.some((c) => c.includes("gemini"))).toBe(false);
  });
});
