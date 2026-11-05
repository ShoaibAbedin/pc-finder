/** Filter state lives in the URL (?q=&min=&max=&r=&pickup=1&stock=all&sort=&page=) so views are bookmarkable. */

export const SORTS = {
  match: "Best match for me",
  drop: "Biggest price drop",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  new: "Newest first",
} as const;
export type SortKey = keyof typeof SORTS;

export interface DealFilters {
  q: string;
  minDollars?: number;
  maxDollars?: number;
  retailers: string[];
  pickupOnly: boolean;
  inStockOnly: boolean;
  sort: SortKey;
  page: number;
}

export const PAGE_SIZE = 48;

type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function dollars(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

export function parseFilters(sp: SP): DealFilters {
  const sort = first(sp.sort);
  let minDollars = dollars(first(sp.min));
  let maxDollars = dollars(first(sp.max));
  if (minDollars !== undefined && maxDollars !== undefined && minDollars > maxDollars) {
    [minDollars, maxDollars] = [maxDollars, minDollars];
  }
  const page = parseInt(first(sp.page) ?? "1", 10);
  return {
    q: (first(sp.q) ?? "").trim().slice(0, 100),
    minDollars,
    maxDollars,
    retailers: all(sp.r)
      .flatMap((s) => s.split(","))
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z0-9-]{1,40}$/.test(s)),
    pickupOnly: first(sp.pickup) === "1",
    inStockOnly: first(sp.stock) !== "all",
    sort: sort && sort in SORTS ? (sort as SortKey) : "match",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/** Builds a query string from filters, omitting defaults. `overrides` lets links change one thing (e.g. page). */
export function toQueryString(f: DealFilters, overrides: Partial<DealFilters> = {}): string {
  const m = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (m.q) p.set("q", m.q);
  if (m.minDollars !== undefined) p.set("min", String(m.minDollars));
  if (m.maxDollars !== undefined) p.set("max", String(m.maxDollars));
  for (const r of m.retailers) p.append("r", r);
  if (m.pickupOnly) p.set("pickup", "1");
  if (!m.inStockOnly) p.set("stock", "all");
  if (m.sort !== "match") p.set("sort", m.sort);
  if (m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Splits a search box value into safe words for ILIKE matching (strips PostgREST/LIKE special characters). */
export function searchTerms(q: string): string[] {
  return q
    .replace(/[%_*,()"'\\:.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 6);
}

export function activeFilterCount(f: DealFilters): number {
  return (
    (f.minDollars !== undefined ? 1 : 0) +
    (f.maxDollars !== undefined ? 1 : 0) +
    (f.retailers.length ? 1 : 0) +
    (f.pickupOnly ? 1 : 0) +
    (f.inStockOnly ? 0 : 1)
  );
}
