export const BUILD_CATEGORIES = ["gpu", "cpu", "motherboard", "ram", "storage", "psu", "case", "cooling"] as const;
export type BuildCategory = (typeof BUILD_CATEGORIES)[number];
