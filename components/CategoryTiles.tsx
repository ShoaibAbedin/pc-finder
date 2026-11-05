import Link from "next/link";
import { CATEGORY_TABS } from "@/lib/categories";
import { CategoryArt } from "./Art";

/** "Shop by category" grid: illustration on a soft tile, bold label below. */
export function CategoryTiles() {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
      {CATEGORY_TABS.map((c) => (
        <Link key={c.slug} href={`/c/${c.slug}`} className="group">
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-tile p-6 text-fg transition-colors group-hover:bg-[#e3e2dc] sm:p-8">
            <CategoryArt category={c.slug} className="h-full w-full max-w-[78%] transition-transform duration-300 group-hover:scale-105" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="display text-xl sm:text-2xl">{c.label}</span>
            <span aria-hidden className="text-muted transition-transform group-hover:translate-x-1">
              →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
