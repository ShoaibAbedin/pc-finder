import Link from "next/link";

export function Section({
  title,
  subtitle,
  href,
  hrefLabel = "Shop all",
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="display text-3xl sm:text-4xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="btn btn-outline btn-sm shrink-0">
            {hrefLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-12 text-center text-sm text-muted">
      <p className="max-w-md">{children}</p>
      {action}
    </div>
  );
}
