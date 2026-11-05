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
      <section className="mb-12 sm:mb-16">
        <p className="eyebrow">Ranked for your build{rankedAt ? ` · ${timeAgo(rankedAt)}` : ""}</p>
        <h1 className="display mt-3 text-6xl sm:text-8xl">For you</h1>
        <p className="mt-4 max-w-xl text-sm text-muted sm:text-base">
          The best current deals for your budget and build — scored on fit, real discounts, stock and Melbourne pickup.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/settings" className="btn btn-primary">
            Edit preferences
          </Link>
          <Link href="/c/all" className="btn btn-outline">
            Browse all deals
          </Link>
        </div>
      </section>

      <section className="mb-16">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="display text-3xl sm:text-4xl">Top {items.length || ""} picks</h2>
          <span className="hidden text-xs text-muted sm:inline">▲▼ change since last update</span>
        </div>
        {items.length ? (
          <ForYouList items={items} />
        ) : (
          <EmptyState
            action={
              <Link href="/settings" className="btn btn-primary btn-sm">
                Open settings
              </Link>
            }
          >
            No ranking yet. It&apos;s created when you save your settings and after each update.
          </EmptyState>
        )}
      </section>

      <Section title="Price drops" subtitle="Compared with the previous price we recorded" href="/c/all?sort=drop">
        {drops.length ? (
          <DealGrid items={drops} />
        ) : (
          <EmptyState>No price drops yet — price history builds up with each update.</EmptyState>
        )}
      </Section>
    </>
  );
}
