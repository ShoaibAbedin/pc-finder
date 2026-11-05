const STYLES = {
  new: "border-accent/40 text-accent",
  drop: "border-transparent bg-good-bg text-good",
  low: "border-good/40 text-good",
  muted: "border-border text-muted",
} as const;

export function Badge({ kind, children }: { kind: keyof typeof STYLES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${STYLES[kind]}`}>
      {children}
    </span>
  );
}
