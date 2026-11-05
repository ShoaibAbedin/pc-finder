import { describe, expect, it } from "vitest";
import { authToken, isAuthorised, safeEqual } from "../lib/auth";

describe("site lock", () => {
  it("derives a stable token that isn't the key itself", async () => {
    const t = await authToken("secret-key");
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(t).toBe(await authToken("secret-key"));
    expect(t).not.toContain("secret-key");
    expect(t).not.toBe(await authToken("other-key"));
  });
  it("authorises only the right cookie", async () => {
    const t = await authToken("k");
    expect(await isAuthorised(t, "k")).toBe(true);
    expect(await isAuthorised(t, "different")).toBe(false);
    expect(await isAuthorised(undefined, "k")).toBe(false);
    expect(await isAuthorised(t, undefined)).toBe(false);
  });
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
