import type { RawListing } from "../../scrapers/core/types";

export interface ExistingProduct {
  id: number;
  external_id: string;
  current_price_cents: number | null;
  in_stock: boolean | null;
  status: string;
  last_changed_at: string;
}

export type ChangeKind = "new" | "changed" | "unchanged";

/** Decides whether a scraped listing needs a new price_history row. */
export function classifyListing(existing: ExistingProduct | undefined, incoming: RawListing): ChangeKind {
  if (!existing) return "new";
  if (existing.current_price_cents !== incoming.priceCents) return "changed";
  if (existing.in_stock !== incoming.inStock) return "changed";
  if (existing.status === "expired") return "changed"; // came back
  return "unchanged";
}

export function statusFor(l: RawListing): "active" | "out_of_stock" {
  return l.inStock === false ? "out_of_stock" : "active";
}
