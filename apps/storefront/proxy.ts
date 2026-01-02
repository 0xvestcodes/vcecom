import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Unified Storefront Proxy
 *
 * Handles:
 * - Maintenance mode check → redirect to maintenance page
 * - Preview mode cookie management
 *
 * Note: This replaces the deprecated middleware.ts convention.
 * The proxy runs on the edge and handles request routing/rewriting.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip proxy for static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Skip maintenance page, admin routes, and preview routes
  if (
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/admin") ||
    pathname.includes("/preview/")
  ) {
    return NextResponse.next();
  }

  // Maintenance mode check removed - content is now hardcoded
  // Maintenance mode can be enabled by setting environment variable or updating code

  // Check for preview mode (from cookie or query param)
  const previewTokenFromQuery =
    request.nextUrl.searchParams.get("previewToken");
  const previewQuery = request.nextUrl.searchParams.get("preview");
  const previewTokenFromCookie = request.cookies.get("preview_token")?.value;

  // If preview token is in query params, set it as a cookie
  if (
    previewTokenFromQuery &&
    previewTokenFromQuery !== previewTokenFromCookie
  ) {
    const response = NextResponse.next();
    response.cookies.set("preview_token", previewTokenFromQuery, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
    response.headers.set("x-preview-mode", "true");
    return response;
  }

  // If preview query param exists, set preview mode header
  if (previewQuery === "true" && previewTokenFromQuery) {
    const response = NextResponse.next();
    response.headers.set("x-preview-mode", "true");
    return response;
  }

  // Let Next.js handle all routing
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
