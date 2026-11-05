import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DealGrid } from "@/components/DealCard";
import { Filters } from "@/components/Filters";
import { OzDealList } from "@/components/OzDealList";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/Section";
import { categoryLabel } from "@/lib/categories";
import { parseFilters } from "@/lib/deals/filters";
import { getListings, getOzDeals, getRetailerOptions } from "@/lib/deals/queries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  return { title: categoryLabel(category) ?? "Not found" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const label = categoryLabel(category);
  if (!label) notFound();

  const f = parseFilters(await searchParams);
  const basePath = `/c/${category}`;
  const [{ items, total }, retailers, oz] = await Promise.all([
    getListings(category, f),
    getRetailerOptions(),
    f.page === 1 ? getOzDeals({ category, limit: 5, filters: f, days: 14 }) : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
        <p className="text-sm text-muted">{total.toLocaleString("en-AU")} listings</p>
      </div>

      <div className="md:flex md:gap-8">
        <Filters f={f} retailers={retailers} basePath={basePath} />

        <div className="min-w-0 flex-1">
          {oz.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-medium text-muted">On OzBargain</h2>
              <OzDealList deals={oz} />
            </div>
          )}

          {items.length ? (
            <>
              <DealGrid items={items} />
              <Pagination f={f} total={total} basePath={basePath} />
            </>
          ) : (
            <EmptyState>No listings match these filters.</EmptyState>
          )}
        </div>
      </div>
    </>
  );
}
