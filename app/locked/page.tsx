import type { Metadata } from "next";
import { PcArt } from "@/components/Art";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LockedPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      <div className="flex size-40 items-center justify-center rounded-[28px] bg-tile p-7 text-fg">
        <PcArt className="h-full w-auto" />
      </div>
      <h1 className="display mt-8 text-6xl">Private</h1>
      <p className="mt-4 text-sm text-muted">Enter your password to continue.</p>
      <LoginForm error={e} />
    </div>
  );
}
