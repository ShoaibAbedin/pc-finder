/**
 * Private-site lock without accounts: visiting /unlock?key=<SITE_KEY> once sets a long-lived,
 * httpOnly cookie holding an HMAC derived from SITE_KEY (never the key itself).
 * Uses Web Crypto so it works in the proxy and in route handlers.
 */
export const AUTH_COOKIE = "pcf_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 400; // ~13 months (browser max)

const enc = new TextEncoder();

export async function authToken(siteKey: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(siteKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("pc-finder-auth-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isAuthorised(cookieValue: string | undefined, siteKey: string | undefined): Promise<boolean> {
  if (!siteKey) return false;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await authToken(siteKey));
}
