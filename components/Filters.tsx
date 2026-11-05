import Link from "next/link";
import { SORTS, activeFilterCount, type DealFilters } from "@/lib/deals/filters";
import type { RetailerOption } from "@/lib/deals/queries";

const pill =
  "flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm transition-colors hover:border-fg has-[:checked]:border-fg has-[:checked]:bg-fg has-[:checked]:text-bg";

/**
 * Plain GET form: works without JavaScript, and filters end up in the URL (bookmarkable).
 * Rendered as a sidebar on desktop and a collapsible panel on mobile.
 */
function FilterForm({ f, retailers, basePath, idPrefix }: Props & { idPrefix: string }) {
  return (
    <form action={basePath} method="get" className="flex flex-col gap-6 text-sm">
      <div>
        <label htmlFor={`${idPrefix}-q`} className="eyebrow mb-2 block">
          Search
        </label>
        <input id={`${idPrefix}-q`} name="q" defaultValue={f.q} placeholder="e.g. 9070 XT" className="field" />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-sort`} className="eyebrow mb-2 block">
          Sort by
        </label>
        <select id={`${idPrefix}-sort`} name="sort" defaultValue={f.sort} className="field appearance-none">
          {Object.entries(SORTS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="eyebrow mb-2">Price (AUD)</legend>
        <div className="flex items-center gap-2">
          <input name="min" inputMode="numeric" placeholder="Min" defaultValue={f.minDollars ?? ""} className="field" aria-label="Minimum price" />
          <span className="text-muted">–</span>
          <input name="max" inputMode="numeric" placeholder="Max" defaultValue={f.maxDollars ?? ""} className="field" aria-label="Maximum price" />
        </div>
      </fieldset>

      {retailers.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-2">Retailer</legend>
          <div className="flex flex-wrap gap-2">
            {retailers.map((r) => (
              <label key={r.id} className={pill}>
                <input type="checkbox" name="r" value={r.id} defaultChecked={f.retailers.includes(r.id)} className="sr-only" />
                {r.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="eyebrow mb-2">Availability</legend>
        <div className="flex flex-wrap gap-2">
          <label className={pill}>
            <input type="checkbox" name="pickup" value="1" defaultChecked={f.pickupOnly} className="sr-only" />
            Melbourne pickup
          </label>
          <label className={pill}>
            {/* checked sends stock=all; unchecked sends nothing → default (in stock only) */}
            <input type="checkbox" name="stock" value="all" defaultChecked={!f.inStockOnly} className="sr-only" />
            Include sold out
          </label>
        </div>
      </fieldset>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn btn-primary flex-1">
          Apply filters
        </button>
        <Link href={basePath} className="btn btn-outline">
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
      <details className="group mb-6 md:hidden">
        <summary className="btn btn-outline w-full cursor-pointer list-none justify-between">
          <span>Filter &amp; sort{n ? ` (${n})` : ""}</span>
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="mt-3 rounded-2xl bg-surface p-5">
          <FilterForm {...props} idPrefix="m" />
        </div>
      </details>
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-44">
          <FilterForm {...props} idPrefix="d" />
        </div>
      </aside>
    </>
  );
}
