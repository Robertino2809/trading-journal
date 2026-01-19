import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthCookieName } from "@/lib/supabase-helpers";

const publicPaths = new Set(["/login", "/register", "/auth/callback"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon.ico")) {
    return NextResponse.next();
  }

  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callbackUrl = new URL("/auth/callback", request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }

  const authCookieName = getAuthCookieName();

  if (!authCookieName) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(authCookieName)?.value);

  if (publicPaths.has(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};