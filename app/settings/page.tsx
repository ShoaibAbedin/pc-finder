import type { Metadata } from "next";
import { AlertsPanel } from "@/components/AlertsPanel";
import { SettingsForm } from "@/components/SettingsForm";
import { loadAlertSettings } from "@/lib/alerts/run";
import { UpdateLog } from "@/components/UpdateLog";
import { createServiceClient } from "@/lib/db/client";
import { loadTargets } from "@/lib/ai/targets";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { loadSettings } from "@/lib/settings/store";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";
export const maxDuration = 60; // saving re-runs the AI targets + ranking

export default async function SettingsPage() {
  const db = createServiceClient();
  const [settings, targets, alerts, watches] = await Promise.all([
    loadSettings(db),
    loadTargets(db),
    loadAlertSettings(db),
    db.from("alert_watches").select("id, query, category, max_price_cents").eq("active", true).order("id"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="display text-6xl sm:text-7xl">Settings</h1>
      <p className="mt-3 text-sm text-muted">Changes re-rank your deals as soon as you save.</p>
      {targets && (
        <div className="mt-8 rounded-2xl bg-surface p-5 text-sm">
          <p className="eyebrow">Your target build</p>
          <p className="mt-1 text-muted">{targets.data.summary}</p>
        </div>
      )}
      <div className="mt-12">
        <SettingsForm initial={settings ?? DEFAULT_SETTINGS} save={saveSettingsAction} />
      </div>
      {alerts && (
        <section id="alerts" className="mt-16 scroll-mt-44">
          <h2 className="display mb-4 text-3xl">Price alerts</h2>
          <AlertsPanel
            topic={alerts.ntfy_topic}
            options={{
              notify_build: alerts.notify_build,
              build_drop_dollars: Math.round(alerts.build_drop_cents / 100),
              notify_top_picks: alerts.notify_top_picks,
              top_pick_drop_pct: alerts.top_pick_drop_pct,
            }}
            watches={watches.data ?? []}
          />
        </section>
      )}
      <section className="mt-16">
        <h2 className="display mb-4 text-3xl">Update log</h2>
        <UpdateLog />
      </section>
    </div>
  );
}
