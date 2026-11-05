"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { refreshStatus, startRefresh } from "@/app/actions/refresh";

const POLL_MS = 15_000;

export function RefreshButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  /** `since`: ignore runs created before this (GitHub takes a few seconds to register a new run). */
  const poll = (since = 0) => {
    stopPolling();
    const startedPolling = Date.now();
    timer.current = setInterval(async () => {
      const s = await refreshStatus().catch((e: Error) => ({ running: false, error: e.message }) as Awaited<ReturnType<typeof refreshStatus>>);
      const isOld = !s.running && s.startedAt && new Date(s.startedAt).getTime() < since - 5_000;
      if (isOld && Date.now() - startedPolling < 120_000) return; // new run not visible yet — keep waiting
      if (s.error) {
        stopPolling();
        setRunning(false);
        setNote(s.error);
      } else if (!s.running) {
        stopPolling();
        setRunning(false);
        setNote(s.finishedOk ? "Updated ✓" : "Update finished with errors — see Settings → Update log");
        router.refresh();
        setTimeout(() => setNote(null), 6000);
      }
    }, POLL_MS);
  };

  // If an update is already running when the page loads, show it.
  useEffect(() => {
    refreshStatus()
      .then((s) => {
        if (s.running) {
          setRunning(true);
          poll();
        }
      })
      .catch(() => {}); // e.g. on the locked page — stay idle
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = () =>
    start(async () => {
      setNote(null);
      const s = await startRefresh().catch((e: Error) => ({ running: false, error: e.message }) as Awaited<ReturnType<typeof startRefresh>>);
      if (s.error) setNote(s.error);
      else if (s.message) setNote(s.message);
      if (s.running) {
        setRunning(true);
        poll(s.startedAt ? new Date(s.startedAt).getTime() : Date.now());
      }
      if (!s.running && s.message) setTimeout(() => setNote(null), 6000);
    });

  const busy = running || pending;
  return (
    <div className="relative">
      <button type="button" onClick={onClick} disabled={busy} className="btn btn-outline btn-sm" aria-live="polite">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={busy ? "animate-spin" : undefined}
          aria-hidden
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        {running ? "Refreshing…" : "Refresh"}
      </button>
      {note && (
        <div
          role="status"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl bg-fg px-4 py-3 text-xs leading-relaxed text-bg shadow-lg"
        >
          {note}
        </div>
      )}
    </div>
  );
}
