import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryArt } from "@/components/Art";
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
      <div className="mb-8 flex items-center justify-between gap-6 overflow-hidden rounded-[28px] bg-tile px-6 py-6 sm:mb-12 sm:px-10 sm:py-8">
        <div>
          <p className="eyebrow">{total.toLocaleString("en-AU")} results</p>
          <h1 className="display mt-2 text-5xl sm:text-8xl">{label}</h1>
        </div>
        <CategoryArt category={category} className="h-24 w-auto shrink-0 text-fg sm:h-40" />
      </div>

      <div className="md:flex md:gap-10">
        <Filters f={f} retailers={retailers} basePath={basePath} />

        <div className="min-w-0 flex-1">
          {oz.length > 0 && (
            <div className="mb-10">
              <h2 className="eyebrow mb-3">Trending on OzBargain</h2>
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
