import type { OzDealListing } from "@/lib/deals/queries";
import { formatPrice, timeAgo } from "@/lib/format";
import { Badge } from "./Badge";

export function OzDealList({ deals }: { deals: OzDealListing[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {deals.map((d) => (
        <li key={d.node_id}>
          <a
            href={d.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-2xl bg-surface p-3 pr-4 transition-colors hover:bg-white/60 sm:p-4"
          >
            <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-tile">
              <span className="text-sm font-semibold tabular-nums text-good">+{d.votes_pos}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted">votes</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{d.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {d.is_new && <Badge kind="new">New</Badge>}
                <span>{d.retailer_name ?? d.store ?? "OzBargain"}</span>
                <span>· {timeAgo(d.posted_at)}</span>
                <span className="hidden sm:inline">· {d.comment_count} comments</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-semibold tabular-nums">{formatPrice(d.price_cents)}</span>
              <span className="btn btn-outline btn-sm hidden group-hover:border-fg sm:inline-flex">View deal</span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
