import type { Metadata } from "next";

export const metadata: Metadata = { title: "Private" };

export default async function LockedPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      <h1 className="text-xl font-semibold">Private site</h1>
      <p className="mt-2 text-sm text-muted">
        {e ? "That unlock link isn't valid." : "Open your personal unlock link on this device to continue."}
      </p>
    </div>
  );
}
