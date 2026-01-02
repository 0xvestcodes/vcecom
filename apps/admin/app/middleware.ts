import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequiredRolesForRoute } from "@/lib/route-permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getUserSession(request: NextRequest): Promise<{
  role: string;
  roleId?: string | null;
} | null> {
  try {
    // Get cookies from request
    const cookieHeader = request.cookies
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Fetch session from backend
    const response = await fetch(`${API_URL}/admin/auth/me`, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
      },
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      role: data.role,
      roleId: data.roleId ?? null,
    };
  } catch (error) {
    console.error("Middleware session fetch error:", error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes - don't check auth for these
  if (
    pathname === "/login" ||
    pathname === "/403" ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    pathname === "/metrics" // Allow metrics endpoint for monitoring tools
  ) {
    return NextResponse.next();
  }

  // Check for admin access token in cookies
  const accessToken = request.cookies.get("admin_access_token");
  const refreshToken = request.cookies.get("admin_refresh_token");

  // If no tokens, redirect to login (but avoid redirect loop)
  if (!accessToken && !refreshToken) {
    // Don't redirect if already going to login
    if (pathname !== "/login") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Check route permissions
  const requiredRoles = getRequiredRolesForRoute(pathname);

  // If route has role restrictions, check user permissions
  if (requiredRoles && requiredRoles.length > 0) {
    const session = await getUserSession(request);

    // If session fetch failed, redirect to login
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Legacy admin role has all permissions
    if (session.role === "admin") {
      const response = NextResponse.next();
      if (accessToken) {
        response.headers.set("x-admin-session", "true");
      }
      return response;
    }

    // Check if user has required role
    if (
      !requiredRoles.includes(session.role as (typeof requiredRoles)[number])
    ) {
      // User doesn't have required role - redirect to 403
      const forbiddenUrl = new URL("/403", request.url);
      forbiddenUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  // Add session info to headers for server components
  const response = NextResponse.next();
  if (accessToken) {
    response.headers.set("x-admin-session", "true");
  }

  return response;
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
