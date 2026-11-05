import Link from "next/link";
import { redirect } from "next/navigation";
import { DealGrid } from "@/components/DealCard";
import { ForYouList } from "@/components/ForYouList";
import { EmptyState, Section } from "@/components/Section";
import { getForYou, hasSettings } from "@/lib/deals/forYou";
import { getPriceDrops } from "@/lib/deals/queries";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasSettings())) redirect("/onboarding");

  const [{ items, rankedAt }, drops] = await Promise.all([getForYou(), getPriceDrops(8)]);

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">For You</h1>
          <p className="mt-1 text-sm text-muted">
            Ranked for your build{rankedAt ? ` · ${timeAgo(rankedAt)}` : ""}. ▲▼ = change since last update.
          </p>
        </div>
        <Link href="/settings" className="shrink-0 text-sm text-accent hover:underline">
          Edit preferences
        </Link>
      </div>

      <div className="mb-10">
        {items.length ? (
          <ForYouList items={items} />
        ) : (
          <EmptyState>
            No ranking yet. It&apos;s created when you save your settings and after each update.
          </EmptyState>
        )}
      </div>

      <Section title="Biggest price drops" subtitle="Compared with the previous price we recorded" href="/c/all?sort=drop">
        {drops.length ? (
          <DealGrid items={drops} />
        ) : (
          <EmptyState>No price drops yet — price history builds up with each update.</EmptyState>
        )}
      </Section>
    </>
  );
}
