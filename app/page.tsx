import Link from "next/link";
import { redirect } from "next/navigation";
import { HeroArt } from "@/components/Art";
import { CategoryTiles } from "@/components/CategoryTiles";
import { DealGrid } from "@/components/DealCard";
import { Features } from "@/components/Features";
import { ForYouList } from "@/components/ForYouList";
import { EmptyState, Section } from "@/components/Section";
import { BuildCard } from "@/components/BuildCard";
import { getBuilds, getForYou, hasSettings } from "@/lib/deals/forYou";
import { getPriceDrops } from "@/lib/deals/queries";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasSettings())) redirect("/onboarding");

  const [{ items, rankedAt }, drops, builds] = await Promise.all([getForYou(), getPriceDrops(8), getBuilds()]);

  return (
    <>
      <section className="mb-14 grid items-center gap-8 sm:mb-20 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        <div>
          <p className="eyebrow">Ranked for your build{rankedAt ? ` · ${timeAgo(rankedAt)}` : ""}</p>
          <h1 className="display mt-3 text-7xl sm:text-9xl">For you</h1>
          <p className="mt-5 max-w-md text-sm text-muted sm:text-base">
            The best current PC deals for your budget and build — scored on fit, real discounts, stock and Melbourne
            pickup.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#build" className="btn btn-primary">
              See my build
            </a>
            <a href="#picks" className="btn btn-outline">
              Top picks
            </a>
            <Link href="/settings" className="btn btn-outline">
              Edit preferences
            </Link>
          </div>
        </div>
        <div className="rounded-[28px] bg-tile px-4 pb-2 pt-6 text-fg sm:px-10 sm:pt-10">
          <HeroArt className="h-auto w-full" />
        </div>
      </section>

      {builds.result && builds.result.builds.length + builds.result.extras.length > 0 && (
        <section id="build" className="mb-16 scroll-mt-44 sm:mb-20">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="display text-4xl sm:text-5xl">Your best build right now</h2>
          </div>
          <BuildCard result={builds.result} prevBestTotal={builds.prevBestTotal} />
        </section>
      )}

      <section className="mb-16 sm:mb-20">
        <Features />
      </section>

      <section id="picks" className="mb-16 scroll-mt-44">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="display text-4xl sm:text-5xl">Top {items.length || ""} picks</h2>
          <span className="hidden text-xs text-muted sm:inline">▲▼ change since last update</span>
        </div>
        {items.length ? (
          <ForYouList items={items} />
        ) : (
          <EmptyState
            art="prebuilt"
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
          <EmptyState art="monitor">No price drops yet — price history builds up with each update.</EmptyState>
        )}
      </Section>

      <Section title="Shop by category">
        <CategoryTiles />
      </Section>
    </>
  );
}
