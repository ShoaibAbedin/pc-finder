import Link from "next/link";
import { PAGE_SIZE, toQueryString, type DealFilters } from "@/lib/deals/filters";

export function Pagination({ f, total, basePath }: { f: DealFilters; total: number; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const link = "rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted-bg";
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
      {f.page > 1 ? (
        <Link className={link} href={`${basePath}${toQueryString(f, { page: f.page - 1 })}`}>
          ← Prev
        </Link>
      ) : (
        <span className={`${link} pointer-events-none opacity-40`}>← Prev</span>
      )}
      <span className="text-sm text-muted">
        Page {f.page} of {pages}
      </span>
      {f.page < pages ? (
        <Link className={link} href={`${basePath}${toQueryString(f, { page: f.page + 1 })}`}>
          Next →
        </Link>
      ) : (
        <span className={`${link} pointer-events-none opacity-40`}>Next →</span>
      )}
    </nav>
  );
}
