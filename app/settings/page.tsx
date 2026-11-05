import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted">
        Coming in Phase 3: your budget, what you&apos;ll use the PC for, preferred brands, parts you already own,
        monitor/peripherals/Windows, and your suburb for click &amp; collect.
      </p>
    </div>
  );
}
