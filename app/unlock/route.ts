import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, authToken, safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const siteKey = process.env.SITE_KEY;
  const given = req.nextUrl.searchParams.get("key") ?? "";
  if (!siteKey || !safeEqual(given, siteKey)) {
    return NextResponse.redirect(new URL("/locked?e=1", req.url));
  }
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(AUTH_COOKIE, await authToken(siteKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
