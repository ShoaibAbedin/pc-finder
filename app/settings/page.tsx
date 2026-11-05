import type { Metadata } from "next";
import { SettingsForm } from "@/components/SettingsForm";
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
  const [settings, targets] = await Promise.all([loadSettings(db), loadTargets(db)]);

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
      <section className="mt-16">
        <h2 className="display mb-4 text-3xl">Update log</h2>
        <UpdateLog />
      </section>
    </div>
  );
}
