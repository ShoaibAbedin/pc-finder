import { categoryLabel } from "@/lib/categories";
import type { ForYouItem } from "@/lib/deals/forYou";
import { formatPrice } from "@/lib/format";
import { Badge } from "./Badge";

function RankChange({ change }: { change: number | null }) {
  if (change === null) return <Badge kind="new">New</Badge>;
  if (change > 0)
    return (
      <span className="text-xs font-medium text-good" title={`Up ${change} since last update`}>
        ▲{change}
      </span>
    );
  if (change < 0)
    return (
      <span className="text-xs font-medium text-muted" title={`Down ${-change} since last update`}>
        ▼{-change}
      </span>
    );
  return <span className="text-xs text-muted" title="No change">–</span>;
}

export function ForYouList({ items }: { items: ForYouItem[] }) {
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {items.map((d) => (
        <li key={d.key}>
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 p-3 hover:bg-muted-bg sm:gap-4 sm:p-4">
            <div className="flex w-8 shrink-0 flex-col items-center gap-1 pt-1">
              <span className="text-sm font-semibold tabular-nums">{d.rank}</span>
              <RankChange change={d.change} />
            </div>
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white sm:size-20">
              {d.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[10px] text-zinc-400">{d.source === "oz" ? "OzB" : ""}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted">{categoryLabel(d.category) ?? d.category}</span>
                {d.price_dropped && <Badge kind="drop">Price dropped</Badge>}
                {d.is_new_listing && d.change !== null && <Badge kind="new">New listing</Badge>}
                {d.source === "oz" && <Badge kind="muted">OzBargain +{d.votes}</Badge>}
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm leading-snug">{d.title}</p>
              {d.reason && <p className="mt-1 text-xs text-good">{d.reason}</p>}
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tracking-tight">{formatPrice(d.price_cents)}</div>
              {d.drop_cents ? (
                <div className="text-xs text-muted line-through">{formatPrice(d.prev_price_cents)}</div>
              ) : null}
              <div className="mt-1 text-xs text-muted">{d.retailer_name ?? "—"}</div>
              {d.melbourne_pickup && <div className="text-xs text-muted">Melb pickup</div>}
            </div>
          </a>
        </li>
      ))}
    </ol>
  );
}
