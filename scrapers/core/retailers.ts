/**
 * Known retailers (IDs must match the `retailers` table seed in supabase/migrations).
 * Used to link OzBargain posts ("... @ Scorptec") to a retailer.
 */
const RETAILER_MATCHERS: { id: string; names: RegExp; hosts: string[] }[] = [
  { id: "pccasegear", names: /\bpc\s?case\s?gear\b|\bpccg\b/i, hosts: ["pccasegear.com"] },
  { id: "scorptec", names: /\bscorptec\b/i, hosts: ["scorptec.com.au"] },
  { id: "umart", names: /\bumart\b/i, hosts: ["umart.com.au"] },
  { id: "msy", names: /\bmsy\b/i, hosts: ["msy.com.au"] },
  { id: "centrecom", names: /\bcentre\s?com\b/i, hosts: ["centrecom.com.au"] },
  { id: "mwave", names: /\bmwave\b/i, hosts: ["mwave.com.au"] },
  { id: "jbhifi", names: /\bjb\s?hi-?fi\b/i, hosts: ["jbhifi.com.au"] },
  { id: "amazon-au", names: /\bamazon\s?(au|australia)\b/i, hosts: ["amazon.com.au"] },
];

export function matchRetailer(store?: string, url?: string): string | undefined {
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const byHost = RETAILER_MATCHERS.find((r) => r.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
      if (byHost) return byHost.id;
    } catch {
      /* ignore bad URL */
    }
  }
  if (store) return RETAILER_MATCHERS.find((r) => r.names.test(store))?.id;
  return undefined;
}
