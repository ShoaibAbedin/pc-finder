import type { OzDealListing } from "@/lib/deals/queries";
import { formatPrice, timeAgo } from "@/lib/format";
import { Badge } from "./Badge";

export function OzDealList({ deals }: { deals: OzDealListing[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {deals.map((d) => (
        <li key={d.node_id}>
          <a
            href={d.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 hover:bg-muted-bg"
          >
            <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-muted-bg py-1 text-xs">
              <span className="font-semibold text-good">+{d.votes_pos}</span>
              <span className="text-[10px] text-muted">votes</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm leading-snug">{d.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {d.is_new && <Badge kind="new">New</Badge>}
                <span>{d.retailer_name ?? d.store ?? "OzBargain"}</span>
                <span>· {timeAgo(d.posted_at)}</span>
                <span>· {d.comment_count} comments</span>
              </p>
            </div>
            <div className="shrink-0 text-right text-sm font-semibold">{formatPrice(d.price_cents)}</div>
          </a>
        </li>
      ))}
    </ul>
  );
}
