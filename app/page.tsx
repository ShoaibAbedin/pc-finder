import Link from "next/link";
import { DealGrid } from "@/components/DealCard";
import { OzDealList } from "@/components/OzDealList";
import { EmptyState, Section } from "@/components/Section";
import { CATEGORY_TABS } from "@/lib/categories";
import { getNewListings, getOzDeals, getPriceDrops } from "@/lib/deals/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [drops, oz, fresh] = await Promise.all([
    getPriceDrops(12),
    getOzDeals({ limit: 8, days: 7 }),
    getNewListings(8),
  ]);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">For You</h1>
        <p className="mt-1 text-sm text-muted">
          Personalised ranking arrives once you set up your build. For now: real price drops (vs our own price history),
          hot OzBargain posts and new listings.
        </p>
      </div>

      <Section title="Biggest price drops" subtitle="Compared with the previous price we recorded" href="/c/all">
        {drops.length ? (
          <DealGrid items={drops} />
        ) : (
          <EmptyState>
            No price drops yet — we need a few update runs to build price history. Check back after the next update.
          </EmptyState>
        )}
      </Section>

      <Section title="Hot on OzBargain" subtitle="Active computing deals from the last 7 days, by votes">
        {oz.length ? <OzDealList deals={oz} /> : <EmptyState>No active OzBargain computing deals right now.</EmptyState>}
      </Section>

      <Section title="Just added" subtitle="Listings that first appeared in the latest update" href="/c/all?sort=new">
        {fresh.length ? <DealGrid items={fresh} /> : <EmptyState>Nothing new in the latest update.</EmptyState>}
      </Section>

      <Section title="Browse by category">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((c) => (
            <Link
              key={c.slug}
              href={`/c/${c.slug}`}
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted-bg"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
