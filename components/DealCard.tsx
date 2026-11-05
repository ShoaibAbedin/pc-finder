import type { DealListing } from "@/lib/deals/queries";
import { formatPrice } from "@/lib/format";
import { Badge } from "./Badge";

export function DealCard({ d }: { d: DealListing }) {
  const outOfStock = d.status === "out_of_stock";
  return (
    <a
      href={d.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-muted"
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-white p-3">
        {d.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className={`max-h-full max-w-full object-contain ${outOfStock ? "opacity-50" : ""}`}
          />
        ) : (
          <span className="text-xs text-zinc-400">No image</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex min-h-5 flex-wrap gap-1">
          {d.is_new && <Badge kind="new">New</Badge>}
          {d.price_dropped && <Badge kind="drop">Price dropped</Badge>}
          {d.is_30d_low && !d.price_dropped && <Badge kind="low">30-day low</Badge>}
          {outOfStock && <Badge kind="muted">Out of stock</Badge>}
        </div>
        <h3 className="line-clamp-2 text-sm leading-snug group-hover:underline">{d.title}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            <div className="text-lg font-semibold tracking-tight">{formatPrice(d.current_price_cents)}</div>
            {d.drop_cents ? (
              <div className="text-xs text-good" title="Compared with the previous price we recorded">
                <span className="text-muted line-through">{formatPrice(d.prev_price_cents)}</span>{" "}
                −{formatPrice(d.drop_cents)} ({d.drop_pct}%)
              </div>
            ) : null}
          </div>
          <div className="text-right text-xs text-muted">
            <div>{d.retailer_name}</div>
            {d.melbourne_pickup && <div>Melb pickup</div>}
          </div>
        </div>
      </div>
    </a>
  );
}

export function DealGrid({ items }: { items: DealListing[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((d) => (
        <DealCard key={d.id} d={d} />
      ))}
    </div>
  );
}
