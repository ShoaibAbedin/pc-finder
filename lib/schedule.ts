/**
 * Update scheduling rules (pure functions — unit tested).
 *
 * GitHub's cron wakes us every 2 hours; `shouldRunUpdate` decides whether an update is due based on
 * UPDATE_INTERVAL_HOURS. A tolerance equal to half the check period stops a 10 h interval drifting to 12 h.
 */
export const CHECK_PERIOD_HOURS = 2;
export const DEFAULT_INTERVAL_HOURS = 10;

export function parseIntervalHours(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 168 ? n : DEFAULT_INTERVAL_HOURS;
}

export function shouldRunUpdate(opts: {
  lastSuccessStart: Date | null;
  intervalHours: number;
  now: Date;
  force?: boolean;
}): { run: boolean; reason: string } {
  if (opts.force) return { run: true, reason: "manual refresh" };
  if (!opts.lastSuccessStart) return { run: true, reason: "no previous successful update" };
  const elapsedH = (opts.now.getTime() - opts.lastSuccessStart.getTime()) / 3_600_000;
  const due = opts.intervalHours - CHECK_PERIOD_HOURS / 2;
  return elapsedH >= due
    ? { run: true, reason: `last update ${elapsedH.toFixed(1)} h ago (interval ${opts.intervalHours} h)` }
    : { run: false, reason: `last update ${elapsedH.toFixed(1)} h ago — next due in ~${(due - elapsedH).toFixed(1)} h` };
}

/* ---------------- Refresh button ---------------- */

export const REFRESH_COOLDOWN_MIN = 10;

export interface WorkflowRunInfo {
  status: string; // queued | in_progress | completed | waiting | requested | pending
  conclusion: string | null; // success | failure | cancelled | ...
  createdAt: string;
  url: string;
}

export function isRunActive(r: WorkflowRunInfo | null): boolean {
  return !!r && r.status !== "completed";
}

/** Can a manual refresh start now? */
export function decideRefresh(latest: WorkflowRunInfo | null, now: Date): { ok: true } | { ok: false; reason: string } {
  if (isRunActive(latest)) return { ok: false, reason: "An update is already running." };
  if (latest) {
    const mins = (now.getTime() - new Date(latest.createdAt).getTime()) / 60_000;
    if (mins < REFRESH_COOLDOWN_MIN)
      return { ok: false, reason: `Updated ${Math.max(1, Math.round(mins))} min ago — try again in ${Math.ceil(REFRESH_COOLDOWN_MIN - mins)} min.` };
  }
  return { ok: true };
}

/** "Updated X ago" turns amber when data is older than this. */
export const STALE_AFTER_HOURS = 24;
export function isStale(lastUpdated: string | null, now = Date.now()): boolean {
  if (!lastUpdated) return true;
  return now - new Date(lastUpdated).getTime() > STALE_AFTER_HOURS * 3_600_000;
}
