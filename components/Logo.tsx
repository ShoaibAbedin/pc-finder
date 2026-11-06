/** Site mark: a monitor with a magnifying glass over its corner (same artwork as the browser-tab icon). */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--fg)" />
      <g fill="none" stroke="var(--bg)" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="6.5" width="18" height="12.5" rx="2" strokeWidth="2.2" />
        <path d="M12 19v3.2M8.6 23.2h6.8" strokeWidth="2.2" />
        <circle cx="21.3" cy="18.6" r="5" fill="var(--fg)" strokeWidth="2.4" />
        <path d="M25 22.3l2.9 2.9" strokeWidth="2.8" />
        <path d="M19.2 16.6a3 3 0 0 1 2-1.1" strokeWidth="1.4" />
      </g>
    </svg>
  );
}
