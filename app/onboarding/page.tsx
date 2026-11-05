import type { Metadata } from "next";
import { SettingsForm } from "@/components/SettingsForm";
import { createServiceClient } from "@/lib/db/client";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { loadSettings } from "@/lib/settings/store";
import { saveSettingsAction } from "../settings/actions";

export const metadata: Metadata = { title: "Set up" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OnboardingPage() {
  const settings = await loadSettings(createServiceClient());
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display text-6xl sm:text-7xl">Let&apos;s find your deals</h1>
      <p className="mt-3 text-sm text-muted">A few quick questions. You can change everything later in Settings.</p>
      <div className="mt-8">
        <SettingsForm initial={settings ?? DEFAULT_SETTINGS} wizard save={saveSettingsAction} />
      </div>
    </div>
  );
}
