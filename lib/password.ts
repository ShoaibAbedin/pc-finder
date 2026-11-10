/**
 * Site password: salted scrypt hash stored in the `site_auth` table (never the password itself).
 * Server-only (uses node:crypto).
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_FAILURES = 10; // per window, across all devices
export const FAILURE_WINDOW_MIN = 15;

export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = (await scrypt(password.normalize("NFKC"), salt, 32)).toString("hex");
  return { salt, hash };
}

export async function checkPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const got = Buffer.from((await hashPassword(password, salt)).hash, "hex");
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function setSitePassword(db: SupabaseClient, password: string) {
  const { salt, hash } = await hashPassword(password);
  const { error } = await db.from("site_auth").upsert({ id: 1, salt, hash, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export type LoginResult = "ok" | "wrong" | "too_many" | "not_set";

export async function verifySitePassword(db: SupabaseClient, password: string): Promise<LoginResult> {
  const since = new Date(Date.now() - FAILURE_WINDOW_MIN * 60_000).toISOString();
  const [{ data: row }, { count }] = await Promise.all([
    db.from("site_auth").select("salt, hash").eq("id", 1).maybeSingle(),
    db.from("site_login_failures").select("id", { count: "exact", head: true }).gte("at", since),
  ]);
  if (!row) return "not_set";
  if ((count ?? 0) >= MAX_FAILURES) return "too_many";
  if (await checkPassword(password, row.salt, row.hash)) return "ok";
  await db.from("site_login_failures").insert({});
  await db.from("site_login_failures").delete().lt("at", new Date(Date.now() - 86_400_000).toISOString());
  return "wrong";
}
