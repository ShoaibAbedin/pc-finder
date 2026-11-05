const STYLES = {
  new: "bg-fg text-bg",
  drop: "bg-good text-white",
  low: "bg-surface text-good ring-1 ring-good/30",
  muted: "bg-surface text-muted ring-1 ring-border",
} as const;

export function Badge({ kind, children }: { kind: keyof typeof STYLES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.06em] ${STYLES[kind]}`}>
      {children}
    </span>
  );
}
