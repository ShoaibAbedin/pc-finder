import { XMLParser } from "fast-xml-parser";
import { parseAudPriceFromTitle } from "../core/price";
import { matchRetailer } from "../core/retailers";
import type { Category, OzDeal, ScraperModule } from "../core/types";

export const OZBARGAIN_FEED_URL = "https://www.ozbargain.com.au/cat/computing/feed";

/** OzBargain tag slug → our category. First match wins, so order specific → generic. */
const TAG_CATEGORY: [RegExp, Category][] = [
  // Laptops/tablets/phones aren't PC parts; catch them first so their "ssd"/"ram" tags don't misfile them.
  [/laptop|notebook|tablet|^ipad|macbook|chromebook|phone|router|network-switch/, "other"],
  [/^(prebuilt|gaming-pc|desktop-pc|desktop-computer|mini-pc|pc)$/, "prebuilt"],
  [/graphics-card|video-card|^gpu$|^rtx|^rx-?\d|geforce|radeon/, "gpu"],
  [/^cpu$|processor|^ryzen|^intel-core|^core-ultra/, "cpu"],
  [/motherboard|^(am4|am5|lga\d+|x870|b850|b650|z890|b860)$/, "motherboard"],
  [/^ram$|^ddr\d|memory-module|^memory$/, "ram"],
  [/ssd|nvme|hard-drive|^hdd$|^storage$|^m-2$/, "storage"],
  [/power-supply|^psu$/, "psu"],
  [/^(pc-case|computer-case|case)$/, "case"],
  [/cooler|cooling|^aio$|^fan$|thermal-paste/, "cooling"],
  [/monitor|display/, "monitor"],
  [/keyboard|mouse|headset|headphones|computer-peripheral|webcam|mousepad/, "peripheral"],
  [/windows|operating-system|^software$/, "software"],
];

export function categoryFromTags(tagSlugs: string[]): Category {
  for (const [re, cat] of TAG_CATEGORY) if (tagSlugs.some((t) => re.test(t))) return cat;
  return "other";
}

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const toIso = (v?: string) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};
const int = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export function parseOzBargainFeed(xml: string, now = new Date()): OzDeal[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    processEntities: true,
    htmlEntities: true,
  });
  const doc = parser.parse(xml);
  const items = asArray(doc?.rss?.channel?.item);
  const deals: OzDeal[] = [];

  for (const it of items) {
    const link: string = it.link ?? "";
    const nodeId = link.match(/\/node\/(\d+)/)?.[1] ?? String(it.guid?.["#text"] ?? it.guid ?? "").split(" ")[0];
    if (!nodeId) continue;

    const title = String(it.title ?? "").trim();
    const meta = it["ozb:meta"] ?? {};
    const categories = asArray<{ "@_domain"?: string; "#text"?: string }>(it.category);
    const tagSlugs = categories
      .map((c) => c["@_domain"]?.match(/\/tag\/([^/?#]+)/)?.[1])
      .filter((s): s is string => !!s);
    const titleMsgs = asArray<{ "@_type"?: string }>(it["ozb:title-msg"]);

    const expiresAt = toIso(meta["@_expiry"]);
    const flaggedExpired = titleMsgs.some((m) => m["@_type"] === "expired");
    const pastExpiry = expiresAt ? new Date(expiresAt) < now : false;

    const store = title.match(/@\s*([^@]+)$/)?.[1]?.trim();
    const dealUrl: string | undefined = meta["@_url"] || undefined;

    deals.push({
      nodeId,
      title,
      link,
      dealUrl,
      store,
      retailerId: matchRetailer(store, dealUrl),
      priceCents: parseAudPriceFromTitle(title),
      category: categoryFromTags(tagSlugs),
      tags: tagSlugs,
      votesPos: int(meta["@_votes-pos"]),
      votesNeg: int(meta["@_votes-neg"]),
      commentCount: int(meta["@_comment-count"]),
      postedAt: toIso(it.pubDate),
      expiresAt,
      expired: flaggedExpired || pastExpiry,
      imageUrl: meta["@_image"] || it["media:thumbnail"]?.["@_url"] || undefined,
    });
  }
  return deals;
}

export const ozbargain: ScraperModule = {
  id: "ozbargain",
  name: "OzBargain (Computing)",
  kind: "aggregator",
  async scrape({ fetch, log }) {
    const xml = await fetch.text(OZBARGAIN_FEED_URL);
    const deals = parseOzBargainFeed(xml);
    log.info(`${deals.length} deals in feed (${deals.filter((d) => d.expired).length} already expired)`);
    return { deals };
  },
};
