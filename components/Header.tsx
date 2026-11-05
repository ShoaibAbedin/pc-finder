import Link from "next/link";
import { getLastUpdated } from "@/lib/deals/queries";
import { melbourneTime, timeAgo } from "@/lib/format";
import { CategoryNav } from "./CategoryNav";

export async function Header() {
  const lastUpdated = await getLastUpdated().catch(() => null);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3 sm:px-6">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          PC Finder
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted sm:gap-3">
          <span className="truncate" title={lastUpdated ? melbourneTime(lastUpdated) : undefined}>
            <span className="hidden sm:inline">Updated </span>
            {timeAgo(lastUpdated)}
          </span>
          <button
            type="button"
            disabled
            title="Refresh will be enabled in Phase 4"
            className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted opacity-60"
          >
            Refresh<span className="hidden sm:inline"> now</span>
          </button>
          <Link href="/settings" className="shrink-0 rounded-full p-1 hover:text-fg" aria-label="Settings" title="Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </Link>
        </div>
      </div>
      <CategoryNav />
    </header>
  );
}
