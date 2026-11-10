import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, authToken } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/client";
import { verifySitePassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/** Password sign-in: a plain form POST from the locked page. Sets the same cookie as /unlock. */
export async function POST(req: NextRequest) {
  const back = (e: string) => NextResponse.redirect(new URL(`/locked?e=${e}`, req.url), 303);
  const siteKey = process.env.SITE_KEY;
  if (!siteKey) return back("config");

  const form = await req.formData().catch(() => null);
  const password = String(form?.get("password") ?? "");
  if (!password) return back("wrong");

  const result = await verifySitePassword(createServiceClient(), password);
  if (result !== "ok") {
    if (result === "wrong") await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return back(result);
  }

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(AUTH_COOKIE, await authToken(siteKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
