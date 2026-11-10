import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthorised } from "./lib/auth";

/** Locks the whole site behind the private unlock link. See lib/auth.ts. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/unlock" || pathname === "/locked" || pathname === "/login") return NextResponse.next();

  const siteKey = process.env.SITE_KEY;
  if (!siteKey) {
    // Local development without a key: allow. In production a missing key keeps the site locked.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return NextResponse.rewrite(new URL("/locked", req.url), { status: 401 });
  }

  if (await isAuthorised(req.cookies.get(AUTH_COOKIE)?.value, siteKey)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/locked", req.url), { status: 401 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|robots.txt).*)"],
};
