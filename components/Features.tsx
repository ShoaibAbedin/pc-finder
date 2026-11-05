import { ClockIcon, PinIcon, TagIcon } from "./Art";

const FEATURES = [
  { Icon: TagIcon, title: "Real discounts", text: "Every price is checked against our own history — not the retailer's “was” price." },
  { Icon: PinIcon, title: "Melbourne first", text: "Click & collect and cheap shipping are boosted for your suburb." },
  { Icon: ClockIcon, title: "Always fresh", text: "Retailers and OzBargain are re-checked every 10 hours. Expired deals drop off." },
];

export function Features() {
  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:gap-5">
      {FEATURES.map(({ Icon, title, text }) => (
        <div key={title} className="flex gap-4 rounded-2xl bg-surface p-5 sm:flex-col sm:gap-5 sm:p-6">
          <Icon className="size-11 shrink-0 text-fg" />
          <div>
            <h3 className="display text-2xl">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
