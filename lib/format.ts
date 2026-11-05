const whole = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 });

/** 129900 → "$1,299", 4597 → "$45.97", null → "—" */
export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return cents % 100 === 0 ? whole.format(cents / 100) : exact.format(cents / 100);
}

/** "just now", "5 min ago", "3 h ago", "2 days ago" */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Absolute time in Melbourne, e.g. "Thu 5 Nov, 11:22 am" */
export function melbourneTime(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
