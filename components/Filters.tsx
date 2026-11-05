import Link from "next/link";
import { SORTS, activeFilterCount, type DealFilters } from "@/lib/deals/filters";
import type { RetailerOption } from "@/lib/deals/queries";

/**
 * Plain GET form: works without JavaScript, and filters end up in the URL (bookmarkable).
 * Rendered as a sidebar on desktop and a collapsible panel on mobile.
 */
function FilterForm({ f, retailers, basePath, idPrefix }: Props & { idPrefix: string }) {
  const input =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-fg";
  return (
    <form action={basePath} method="get" className="flex flex-col gap-5 text-sm">
      <div>
        <label htmlFor={`${idPrefix}-q`} className="mb-1.5 block font-medium">
          Search
        </label>
        <input id={`${idPrefix}-q`} name="q" defaultValue={f.q} placeholder="e.g. 9070 XT" className={input} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-sort`} className="mb-1.5 block font-medium">
          Sort
        </label>
        <select id={`${idPrefix}-sort`} name="sort" defaultValue={f.sort} className={input}>
          {Object.entries(SORTS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-1.5 font-medium">Price (AUD)</legend>
        <div className="flex items-center gap-2">
          <input name="min" inputMode="numeric" placeholder="Min" defaultValue={f.minDollars ?? ""} className={input} aria-label="Minimum price" />
          <span className="text-muted">–</span>
          <input name="max" inputMode="numeric" placeholder="Max" defaultValue={f.maxDollars ?? ""} className={input} aria-label="Maximum price" />
        </div>
      </fieldset>

      {retailers.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 font-medium">Retailer</legend>
          <div className="flex flex-col gap-1.5">
            {retailers.map((r) => (
              <label key={r.id} className="flex items-center gap-2">
                <input type="checkbox" name="r" value={r.id} defaultChecked={f.retailers.includes(r.id)} className="size-4 accent-current" />
                <span>{r.name}</span>
                <span className="ml-auto text-xs text-muted">{r.listing_count.toLocaleString("en-AU")}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">Availability</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="pickup" value="1" defaultChecked={f.pickupOnly} className="size-4" />
          Melbourne click &amp; collect
        </label>
        <label className="flex items-center gap-2">
          {/* checked sends stock=all; unchecked sends nothing → default (in stock only) */}
          <input type="checkbox" name="stock" value="all" defaultChecked={!f.inStockOnly} className="size-4" />
          Include out of stock
        </label>
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-lg bg-fg px-4 py-2 font-medium text-bg">
          Apply
        </button>
        <Link href={basePath} className="rounded-lg border border-border px-4 py-2 text-muted hover:text-fg">
          Reset
        </Link>
      </div>
    </form>
  );
}

interface Props {
  f: DealFilters;
  retailers: RetailerOption[];
  basePath: string;
}

export function Filters(props: Props) {
  const n = activeFilterCount(props.f);
  return (
    <>
      <details className="mb-4 rounded-xl border border-border md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
          <span>Filters &amp; sort{n ? ` · ${n} active` : ""}</span>
          <span aria-hidden className="text-muted">▾</span>
        </summary>
        <div className="border-t border-border p-4">
          <FilterForm {...props} idPrefix="m" />
        </div>
      </details>
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-32">
          <FilterForm {...props} idPrefix="d" />
        </div>
      </aside>
    </>
  );
}
