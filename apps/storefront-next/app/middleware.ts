import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getCustomerSession(request: NextRequest): Promise<{
  id: string;
  email: string;
} | null> {
  try {
    // Get cookies from request
    const cookieHeader = request.cookies
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Fetch session from backend
    const response = await fetch(`${API_URL}/store/customers/me`, {
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
      id: data.id,
      email: data.email,
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
    pathname === "/register" ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/collections") ||
    pathname.startsWith("/search") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Protected routes: account, checkout (after start)
  const isProtectedRoute =
    pathname.startsWith("/account") ||
    (pathname.startsWith("/checkout") && pathname !== "/checkout");

  if (isProtectedRoute) {
    // Check for access token in cookies
    const accessToken = request.cookies.get("access_token");
    const refreshToken = request.cookies.get("refresh_token");

    // If no tokens, redirect to login
    if (!accessToken && !refreshToken) {
      if (pathname !== "/login") {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    // Verify session with backend
    const session = await getCustomerSession(request);

    // If session fetch failed, redirect to login
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Add session info to headers for server components
    const response = NextResponse.next();
    if (accessToken) {
      response.headers.set("x-customer-session", "true");
      response.headers.set("x-customer-id", session.id);
    }

    return response;
  }

  // For cart and checkout/start, allow but add session info if available
  if (pathname === "/cart" || pathname === "/checkout") {
    const response = NextResponse.next();
    const accessToken = request.cookies.get("access_token");
    if (accessToken) {
      const session = await getCustomerSession(request);
      if (session) {
        response.headers.set("x-customer-session", "true");
        response.headers.set("x-customer-id", session.id);
      }
    }
    return response;
  }

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
