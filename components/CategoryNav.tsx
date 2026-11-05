"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORY_TABS } from "@/lib/categories";

const TABS = [{ href: "/", label: "For You" }, { href: "/c/all", label: "All" }].concat(
  CATEGORY_TABS.map((c) => ({ href: `/c/${c.slug}`, label: c.label })),
);

export function CategoryNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto max-w-6xl px-2 sm:px-4" aria-label="Categories">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto py-2">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="shrink-0">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-full px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-fg text-bg" : "text-muted hover:bg-muted-bg hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
