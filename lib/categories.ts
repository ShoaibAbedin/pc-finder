import type { Category } from "../scrapers/core/types";

export const CATEGORY_TABS: { slug: Category; label: string }[] = [
  { slug: "gpu", label: "GPU" },
  { slug: "cpu", label: "CPU" },
  { slug: "motherboard", label: "Motherboard" },
  { slug: "ram", label: "RAM" },
  { slug: "storage", label: "Storage" },
  { slug: "psu", label: "PSU" },
  { slug: "case", label: "Case" },
  { slug: "cooling", label: "Cooling" },
  { slug: "prebuilt", label: "Prebuilts" },
  { slug: "monitor", label: "Monitors" },
  { slug: "peripheral", label: "Peripherals" },
  { slug: "software", label: "Windows" },
];

export function categoryLabel(slug: string): string | undefined {
  if (slug === "all") return "All deals";
  return CATEGORY_TABS.find((c) => c.slug === slug)?.label;
}
