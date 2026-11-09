"use client";

import { useState, useTransition } from "react";
import { addWatch, deleteWatch, saveAlertOptions, sendTestAlert } from "@/app/settings/alert-actions";
import { CATEGORY_TABS } from "@/lib/categories";

interface Props {
  topic: string;
  options: { notify_build: boolean; build_drop_dollars: number; notify_top_picks: boolean; top_pick_drop_pct: number };
  watches: { id: number; query: string; category: string | null; max_price_cents: number }[];
}

export function AlertsPanel({ topic, options, watches }: Props) {
  const [opts, setOpts] = useState(options);
  const [watch, setWatch] = useState({ query: "", category: "", max_dollars: "" });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      setMsg(null);
      setMsg(await fn());
    });

  const subscribeUrl = `https://ntfy.sh/${topic}`;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. setup */}
      <div className="rounded-2xl bg-surface p-5 text-sm">
        <p className="eyebrow">Get alerts on your phone (one-time setup)</p>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
          <li>
            Install the free <b>ntfy</b> app (App Store / Google Play). No account needed.
          </li>
          <li>
            Tap <b>+</b> → <b>Subscribe to topic</b> and enter:
            <code className="mt-1 block select-all break-all rounded-lg bg-muted-bg px-3 py-2 font-mono text-xs">{topic}</code>
          </li>
          <li>Tap the button below to check it works.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => run(sendTestAlert)} className="btn btn-primary btn-sm">
            Send test alert
          </button>
          <a href={subscribeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
            Open in browser instead
          </a>
        </div>
        <p className="mt-3 text-xs text-muted">Keep this topic name private — anyone who knows it can read your alerts.</p>
      </div>

      {/* 2. automatic alerts */}
      <div className="rounded-2xl bg-surface p-5 text-sm">
        <p className="eyebrow">Automatic alerts</p>
        <label className="mt-3 flex flex-wrap items-center gap-2">
          <input type="checkbox" className="size-4" checked={opts.notify_build} onChange={(e) => setOpts({ ...opts, notify_build: e.target.checked })} />
          My best build gets cheaper by at least $
          <input
            className="field w-24 py-1.5"
            inputMode="numeric"
            value={opts.build_drop_dollars}
            onChange={(e) => setOpts({ ...opts, build_drop_dollars: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          />
        </label>
        <label className="mt-3 flex flex-wrap items-center gap-2">
          <input type="checkbox" className="size-4" checked={opts.notify_top_picks} onChange={(e) => setOpts({ ...opts, notify_top_picks: e.target.checked })} />
          A top pick drops by at least
          <input
            className="field w-20 py-1.5"
            inputMode="numeric"
            value={opts.top_pick_drop_pct}
            onChange={(e) => setOpts({ ...opts, top_pick_drop_pct: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          />
          % (vs our price history)
        </label>
        <button type="button" disabled={pending} onClick={() => run(() => saveAlertOptions(opts))} className="btn btn-outline btn-sm mt-4">
          Save alert options
        </button>
      </div>

      {/* 3. watches */}
      <div className="rounded-2xl bg-surface p-5 text-sm">
        <p className="eyebrow">Watch a specific part</p>
        <p className="mt-1 text-xs text-muted">Get a notification when any store lists it (in stock) at or below your price.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px_120px_auto]">
          <input className="field" placeholder="e.g. RTX 5070 or 9800X3D" value={watch.query} onChange={(e) => setWatch({ ...watch, query: e.target.value })} />
          <select className="field" value={watch.category} onChange={(e) => setWatch({ ...watch, category: e.target.value })}>
            <option value="">Any category</option>
            {CATEGORY_TABS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className="field"
            inputMode="numeric"
            placeholder="Max $"
            value={watch.max_dollars}
            onChange={(e) => setWatch({ ...watch, max_dollars: e.target.value.replace(/\D/g, "") })}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await addWatch(watch);
                if (r.ok) setWatch({ query: "", category: "", max_dollars: "" });
                return r;
              })
            }
            className="btn btn-primary"
          >
            Add
          </button>
        </div>
        {watches.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {watches.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  <b>{w.query}</b>
                  {w.category ? <span className="text-muted"> · {CATEGORY_TABS.find((c) => c.slug === w.category)?.label}</span> : null} under{" "}
                  <b>${Math.round(w.max_price_cents / 100).toLocaleString("en-AU")}</b>
                </span>
                <button type="button" disabled={pending} onClick={() => run(() => deleteWatch(w.id))} className="btn btn-outline btn-sm">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-muted">No watches yet.</p>
        )}
      </div>

      {msg && (
        <p role="status" className={`text-sm font-medium ${msg.ok ? "text-good" : "text-red-700"}`}>
          {msg.message}
        </p>
      )}
      <p className="text-xs text-muted">Alerts are checked after every update (every 12 h, every 8 h in Black Friday week). At most 6 per update.</p>
    </div>
  );
}
