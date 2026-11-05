import Link from "next/link";
import { PAGE_SIZE, toQueryString, type DealFilters } from "@/lib/deals/filters";

export function Pagination({ f, total, basePath }: { f: DealFilters; total: number; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pagination">
      {f.page > 1 ? (
        <Link className="btn btn-outline" href={`${basePath}${toQueryString(f, { page: f.page - 1 })}`}>
          ← Previous
        </Link>
      ) : (
        <span className="btn btn-outline pointer-events-none opacity-30">← Previous</span>
      )}
      <span className="px-2 text-sm tabular-nums text-muted">
        {f.page} / {pages}
      </span>
      {f.page < pages ? (
        <Link className="btn btn-primary" href={`${basePath}${toQueryString(f, { page: f.page + 1 })}`}>
          Next →
        </Link>
      ) : (
        <span className="btn btn-primary pointer-events-none opacity-30">Next →</span>
      )}
    </nav>
  );
}
