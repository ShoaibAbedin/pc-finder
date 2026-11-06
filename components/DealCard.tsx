import { categoryLabel } from "@/lib/categories";
import type { DealListing } from "@/lib/deals/queries";
import { formatPrice } from "@/lib/format";
import { CategoryArt } from "./Art";
import { Badge } from "./Badge";

export function ProductImage({
  src,
  dim,
  category,
  className = "",
}: {
  src: string | null;
  dim?: boolean;
  category?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-tile ${className}`}>
      {src ? (
        // mix-blend-multiply melts white product backgrounds into the grey tile
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={`h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.04] ${dim ? "opacity-50" : ""}`}
        />
      ) : category ? (
        // Store didn't provide a photo — show our illustration for the category instead
        <CategoryArt category={category} className={`h-3/5 w-3/5 text-fg/70 ${dim ? "opacity-50" : ""}`} />
      ) : (
        <span className="eyebrow">No image</span>
      )}
    </div>
  );
}

export function DealCard({ d }: { d: DealListing }) {
  const outOfStock = d.status === "out_of_stock";
  return (
    <a href={d.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col">
      <div className="relative">
        <ProductImage src={d.image_url} dim={outOfStock} category={d.category} className="aspect-square rounded-2xl p-6 sm:p-8" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          {d.is_new && <Badge kind="new">New</Badge>}
          {d.price_dropped && <Badge kind="drop">Price drop</Badge>}
          {d.is_30d_low && !d.price_dropped && <Badge kind="low">30-day low</Badge>}
          {outOfStock && <Badge kind="muted">Sold out</Badge>}
        </div>
        {d.match_score != null && (
          <span className="absolute right-3 top-3 rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold tabular-nums" title="How well this fits your build (0–100)">
            {Math.round(d.match_score)} match
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col pt-3">
        <p className="eyebrow">
          {categoryLabel(d.category)} · {d.retailer_name}
          {d.melbourne_pickup ? " · Melb pickup" : ""}
        </p>
        <h3 className="mt-1 line-clamp-2 text-[15px] font-medium leading-snug">{d.title}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <div className="text-base font-semibold tabular-nums">{formatPrice(d.current_price_cents)}</div>
            {d.drop_cents ? (
              <div className="text-xs tabular-nums" title="Compared with the previous price we recorded">
                <span className="text-muted line-through">{formatPrice(d.prev_price_cents)}</span>{" "}
                <span className="font-medium text-good">−{d.drop_pct}%</span>
              </div>
            ) : null}
          </div>
          <span className="btn btn-outline btn-sm group-hover:border-fg">View deal</span>
        </div>
      </div>
    </a>
  );
}

export function DealGrid({ items }: { items: DealListing[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
      {items.map((d) => (
        <DealCard key={d.id} d={d} />
      ))}
    </div>
  );
}
