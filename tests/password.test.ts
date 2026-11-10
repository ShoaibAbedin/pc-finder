import { describe, expect, it } from "vitest";
import { checkPassword, hashPassword } from "../lib/password";

describe("site password", () => {
  it("stores a salted hash, not the password", async () => {
    const a = await hashPassword("correct horse");
    const b = await hashPassword("correct horse");
    expect(a.hash).not.toContain("correct");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
  it("accepts only the right password", async () => {
    const { salt, hash } = await hashPassword("correct horse");
    expect(await checkPassword("correct horse", salt, hash)).toBe(true);
    expect(await checkPassword("Correct horse", salt, hash)).toBe(false);
    expect(await checkPassword("", salt, hash)).toBe(false);
  });
});
