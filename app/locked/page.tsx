import type { Metadata } from "next";
import { PcArt } from "@/components/Art";

export const metadata: Metadata = { title: "Private" };

export default async function LockedPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="flex size-48 items-center justify-center rounded-[28px] bg-tile p-8 text-fg">
        <PcArt className="h-full w-auto" />
      </div>
      <h1 className="display mt-8 text-6xl">Private</h1>
      <p className="mt-4 text-sm text-muted">
        {e ? "That unlock link isn't valid." : "Open your personal unlock link on this device to continue."}
      </p>
    </div>
  );
}
