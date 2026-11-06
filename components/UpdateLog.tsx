import { createServiceClient } from "@/lib/db/client";
import { timeAgo } from "@/lib/format";

interface Run {
  source_id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "partial" | "blocked" | "error";
  items_found: number;
  items_new: number;
  items_changed: number;
  items_expired: number;
  message: string | null;
}

const STATUS: Record<Run["status"], { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-good-bg text-good" },
  partial: { label: "Partial", cls: "bg-amber-100 text-amber-800" },
  blocked: { label: "Blocked", cls: "bg-amber-100 text-amber-800" },
  error: { label: "Error", cls: "bg-red-100 text-red-800" },
  running: { label: "Running", cls: "bg-muted-bg text-muted" },
};

/** Latest run per source + today's AI usage. */
export async function UpdateLog() {
  const db = createServiceClient();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
  const [{ data: runs }, { data: ai }, { data: rank }] = await Promise.all([
    db.from("scrape_runs").select("*").order("started_at", { ascending: false }).limit(60),
    db.from("ai_usage").select("provider, requests, failures").eq("day", day),
    db.from("ranking_runs").select("created_at").order("id", { ascending: false }).limit(1),
  ]);
  const latest = new Map<string, Run>();
  for (const r of (runs ?? []) as Run[]) if (!latest.has(r.source_id)) latest.set(r.source_id, r);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl bg-surface">
        {[...latest.values()].map((r) => (
          <div key={r.source_id} className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 last:border-0">
            <div className="min-w-0">
              <p className="font-medium capitalize">{r.source_id}</p>
              <p className="mt-0.5 text-xs text-muted">
                {timeAgo(r.started_at)} · {r.items_found.toLocaleString("en-AU")} found · {r.items_new} new · {r.items_changed} changed ·{" "}
                {r.items_expired} expired
              </p>
              {r.message && <p className="mt-1 line-clamp-2 text-xs text-muted">{r.message}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATUS[r.status].cls}`}>
              {STATUS[r.status].label}
            </span>
          </div>
        ))}
        {!latest.size && <p className="px-5 py-4 text-sm text-muted">No updates yet.</p>}
      </div>
      <p className="text-xs text-muted">
        Ranking {rank?.[0] ? `updated ${timeAgo(rank[0].created_at)}` : "not run yet"} · AI requests today:{" "}
        {(ai ?? []).map((a) => `${a.provider} ${a.requests}${a.failures ? ` (${a.failures} failed)` : ""}`).join(", ") || "none"} ·
        Update interval: GitHub repo → Settings → Secrets and variables → Actions → Variables → UPDATE_INTERVAL_HOURS (default 12; 8 h automatically in Black Friday week)
      </p>
    </div>
  );
}
