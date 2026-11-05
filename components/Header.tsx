import Link from "next/link";
import { getLastUpdated } from "@/lib/deals/queries";
import { melbourneTime, timeAgo } from "@/lib/format";
import { CategoryNav } from "./CategoryNav";

const BLACK_FRIDAY = new Date("2026-11-27T00:00:00+11:00");

function blackFridayText(now = Date.now()) {
  const days = Math.ceil((BLACK_FRIDAY.getTime() - now) / 86_400_000);
  if (days > 1) return `Black Friday in ${days} days`;
  if (days === 1) return "Black Friday is tomorrow";
  if (days > -4) return "Black Friday sales are on";
  return "Prices tracked across Australian retailers";
}

export async function Header() {
  const lastUpdated = await getLastUpdated().catch(() => null);

  return (
    <header className="sticky top-0 z-30">
      <div className="bg-fg text-bg">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] sm:px-8">
          {blackFridayText()}
        </div>
      </div>
      <div className="border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
          <Link href="/" className="display text-2xl sm:text-[28px]">
            PC Finder
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span
              className="hidden truncate text-xs text-muted sm:inline"
              title={lastUpdated ? melbourneTime(lastUpdated) : undefined}
            >
              Updated {timeAgo(lastUpdated)}
            </span>
            <button type="button" disabled title="Refresh will be enabled in Phase 4" className="btn btn-outline btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              Refresh
            </button>
            <Link href="/settings" className="btn btn-primary btn-sm">
              Settings
            </Link>
          </div>
        </div>
        <CategoryNav />
      </div>
    </header>
  );
}
