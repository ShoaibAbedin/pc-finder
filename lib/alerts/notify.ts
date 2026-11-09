/**
 * Push notifications via ntfy (https://ntfy.sh): free, no account. The phone app subscribes to a private
 * topic name; we POST messages to it. Headers must be ASCII, so titles are sanitised; the body can be UTF-8.
 */
export const NTFY_SERVER = "https://ntfy.sh";

export interface Push {
  title: string;
  message: string;
  url?: string;
  tags?: string[]; // ntfy emoji shortcodes, e.g. "chart_with_downwards_trend"
  priority?: 1 | 2 | 3 | 4 | 5;
}

const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, "").slice(0, 200);

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

export async function sendPush(topic: string, p: Push, fetchImpl: FetchImpl = (u, i) => fetch(u, i)): Promise<void> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(topic)) throw new Error("Invalid ntfy topic");
  const headers: Record<string, string> = { Title: ascii(p.title), Priority: String(p.priority ?? 3) };
  if (p.url) headers.Click = p.url;
  if (p.tags?.length) headers.Tags = p.tags.map(ascii).join(",");
  const res = await fetchImpl(`${NTFY_SERVER}/${topic}`, { method: "POST", headers, body: p.message, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ntfy: HTTP ${res.status}`);
}
