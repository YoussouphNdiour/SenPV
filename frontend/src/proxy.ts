import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const publicPaths = ["/", "/auth/login", "/auth/register"];
const installerPaths = ["/clients"];
const adminPaths = ["/admin"];

function isPublicPath(pathname: string): boolean {
  // Strip locale prefix for matching
  const pathWithoutLocale = pathname.replace(/^\/(fr|en)/, "") || "/";
  return publicPaths.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip i18n and auth entirely for API routes and static assets
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // Let next-intl handle locale routing
  const response = intlMiddleware(request);

  // Skip auth check for public paths
  if (isPublicPath(pathname)) {
    return response;
  }

  // Check for NextAuth session token
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    const locale = pathname.match(/^\/(fr|en)/)?.[1] || "fr";
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads|sitemap.xml|robots.txt).*)",
  ],
};
