import { categoryLabel } from "@/lib/categories";
import type { ForYouItem } from "@/lib/deals/forYou";
import { formatPrice } from "@/lib/format";
import { Badge } from "./Badge";
import { ProductImage } from "./DealCard";

function RankChange({ change }: { change: number | null }) {
  if (change === null) return <Badge kind="new">New</Badge>;
  if (change > 0)
    return (
      <span className="text-xs font-semibold text-good" title={`Up ${change} since last update`}>
        ▲ {change}
      </span>
    );
  if (change < 0)
    return (
      <span className="text-xs font-semibold text-muted" title={`Down ${-change} since last update`}>
        ▼ {-change}
      </span>
    );
  return (
    <span className="text-xs text-muted" title="No change since last update">
      —
    </span>
  );
}

export function ForYouList({ items }: { items: ForYouItem[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((d) => (
        <li key={d.key}>
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-stretch gap-3 rounded-2xl bg-surface p-3 sm:gap-5 sm:p-4"
          >
            <div className="flex w-9 shrink-0 flex-col items-center justify-center gap-1 sm:w-12">
              <span className="display text-3xl tabular-nums sm:text-4xl">{d.rank}</span>
              <RankChange change={d.change} />
            </div>
            <ProductImage src={d.image_url} category={d.category} className="size-24 shrink-0 rounded-xl p-2 sm:size-32 sm:p-3" />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="eyebrow">{categoryLabel(d.category) ?? d.category}</span>
                {d.price_dropped && <Badge kind="drop">Price drop</Badge>}
                {d.is_new_listing && d.change !== null && <Badge kind="new">New listing</Badge>}
                {d.source === "oz" && <Badge kind="muted">OzBargain +{d.votes}</Badge>}
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug sm:text-[15px]">{d.title}</p>
              {d.reason && <p className="mt-1.5 line-clamp-2 text-xs text-good sm:text-sm">{d.reason}</p>}
              {d.also && d.also.length > 0 && (
                <p className="mt-1 text-xs text-muted">
                  Also at{" "}
                  {d.also.map((o, i) => (
                    <span key={o.retailer}>
                      {i > 0 && " · "}
                      {o.retailer} {formatPrice(o.priceCents)}
                    </span>
                  ))}
                </p>
              )}
              <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                <div className="text-xs text-muted">
                  {d.retailer_name ?? "—"}
                  {d.melbourne_pickup ? " · Melb pickup" : ""}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{formatPrice(d.price_cents)}</div>
                    {d.drop_cents ? (
                      <div className="text-xs tabular-nums text-muted line-through">{formatPrice(d.prev_price_cents)}</div>
                    ) : null}
                  </div>
                  <span className="btn btn-primary btn-sm hidden sm:inline-flex">View deal</span>
                </div>
              </div>
            </div>
          </a>
        </li>
      ))}
    </ol>
  );
}
