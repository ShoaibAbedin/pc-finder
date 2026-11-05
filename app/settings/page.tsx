import type { Metadata } from "next";
import { SettingsForm } from "@/components/SettingsForm";
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
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted">Changes re-rank your deals as soon as you save.</p>
      {targets && (
        <div className="mt-6 rounded-xl border border-border p-4 text-sm">
          <p className="font-medium">Your target build</p>
          <p className="mt-1 text-muted">{targets.data.summary}</p>
        </div>
      )}
      <div className="mt-8">
        <SettingsForm initial={settings ?? DEFAULT_SETTINGS} save={saveSettingsAction} />
      </div>
    </div>
  );
}
