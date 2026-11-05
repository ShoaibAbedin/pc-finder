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
    <nav className="mx-auto max-w-7xl px-2 sm:px-6" aria-label="Categories">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:justify-center">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="shrink-0">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative block px-3 py-3 text-sm font-medium transition-colors ${
                  active ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {t.label}
                <span
                  className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-fg transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
