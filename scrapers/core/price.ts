/** "1,299.00" / "1299" / 1299.5 → 129900 / 129950 cents. Returns null for anything unparseable. */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const s = typeof value === "number" ? String(value) : value.replace(/[,\s$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/**
 * Extracts the AUD price from an OzBargain-style deal title.
 *  "... $46 + Delivery @ JW"                → 4600
 *  "... US$45.97 (~A$65.80) Delivered"      → 6580 (prefers explicit A$)
 *  "... $1,299 ... was $1,499"              → 129900 (first plain $ amount)
 * Ignores foreign-currency amounts (US$, NZ$, €, £) when no AUD amount is present.
 */
export function parseAudPriceFromTitle(title: string): number | null {
  const audExplicit = title.match(/(?:A|AU|AUD)\s?\$\s?(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (audExplicit?.[1]) return toCents(audExplicit[1]);

  // Plain "$123" not preceded by letters (excludes US$, NZ$, C$, ...)
  const re = /(^|[^A-Za-z$])\$\s?(\d[\d,]*(?:\.\d{1,2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title))) {
    const before = title.slice(Math.max(0, m.index - 12), m.index + m[1]!.length).toLowerCase();
    // Skip cashback / discount amounts like "$50 off", "$20 cashback", "spend $300"
    const after = title.slice(re.lastIndex, re.lastIndex + 12).toLowerCase();
    if (/^\s*(off|cashback|cash back|credit|gift card|voucher|back)\b/.test(after)) continue;
    if (/(spend|over|min\.?|minimum)\s*$/.test(before)) continue;
    return toCents(m[2]!);
  }
  return null;
}
