import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Centralized proxy API route for all backend requests
 * Handles authentication, token refresh, and cookie forwarding
 * 
 * Usage: /api/proxy/admin/products -> proxies to backend /admin/products
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, params, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, params, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, params, "PUT");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, params, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handleRequest(request, params, "DELETE");
}

async function handleRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string,
) {
  try {
    const { path } = await params;
    const backendPath = `/${path.join("/")}`;
    const searchParams = request.nextUrl.searchParams.toString();
    const backendUrl = `${API_URL}${backendPath}${searchParams ? `?${searchParams}` : ""}`;

    // Get cookies from Next.js
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Get request body if present
    let body: string | undefined;
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = await request.text();
      } catch {
        // No body
      }
    }

    // Get store ID from header if present
    const storeId = request.headers.get("x-store-id");

    // Forward request to backend
    const headers: HeadersInit = {
      Cookie: cookieHeader,
      "Content-Type": request.headers.get("content-type") || "application/json",
    };

    if (storeId) {
      headers["x-store-id"] = storeId;
    }

    const response = await fetch(backendUrl, {
      method,
      headers,
      body,
      credentials: "include",
    });

    // Handle 401 - try to refresh token
    if (response.status === 401 && !backendPath.includes("/auth/refresh") && !backendPath.includes("/auth/login")) {
      // Check if refresh token exists before attempting refresh
      const hasRefreshToken = cookieHeader.includes("admin_refresh_token");
      
      if (!hasRefreshToken) {
        // No refresh token - session truly expired
        const error = await response.json().catch(() => ({
          message: "Unauthorized - session expired",
        }));
        return NextResponse.json(error, { status: 401 });
      }

      // Attempt to refresh token
      const refreshResponse = await fetch(`${API_URL}/admin/auth/refresh`, {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
        },
        credentials: "include",
      });

      if (refreshResponse.ok) {
        // Refresh successful - get updated cookies
        const refreshSetCookieHeaders = refreshResponse.headers.getSetCookie();
        
        // Build updated cookie header for retry
        let updatedCookieHeader = cookieHeader;
        if (refreshSetCookieHeaders && refreshSetCookieHeaders.length > 0) {
          // Update cookie header with new tokens
          const cookieMap = new Map<string, string>();
          // Parse existing cookies
          cookieHeader.split(";").forEach((cookie) => {
            const [name, ...valueParts] = cookie.trim().split("=");
            if (name && valueParts.length > 0) {
              cookieMap.set(name, valueParts.join("="));
            }
          });
          // Update with new cookies from refresh
          refreshSetCookieHeaders.forEach((cookieString) => {
            const parts = cookieString.split(";").map((p) => p.trim());
            const [nameValue] = parts;
            const [name, ...valueParts] = nameValue.split("=");
            if (name && valueParts.length > 0) {
              cookieMap.set(name, valueParts.join("="));
            }
          });
          updatedCookieHeader = Array.from(cookieMap.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join("; ");
        }
        
        // Retry original request with updated cookies
        const retryHeaders: HeadersInit = {
          ...headers,
          Cookie: updatedCookieHeader,
        };
        
        const retryResponse = await fetch(backendUrl, {
          method,
          headers: retryHeaders,
          body,
          credentials: "include",
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({
            message: `Request failed with status ${retryResponse.status}`,
          }));
          return NextResponse.json(error, { status: retryResponse.status });
        }

        const retryData = await retryResponse.json();
        const nextResponse = NextResponse.json(retryData, {
          status: retryResponse.status,
        });

        // Forward cookies from refresh response
        if (refreshSetCookieHeaders && refreshSetCookieHeaders.length > 0) {
          forwardCookies(refreshSetCookieHeaders, nextResponse);
        }

        // Forward cookies from retry response
        const retrySetCookieHeaders = retryResponse.headers.getSetCookie();
        if (retrySetCookieHeaders && retrySetCookieHeaders.length > 0) {
          forwardCookies(retrySetCookieHeaders, nextResponse);
        }

        return nextResponse;
      } else {
        // Refresh failed - check if it's a 401 (token expired) or other error
        const refreshStatus = refreshResponse.status;
        const error = await refreshResponse.json().catch(() => ({
          message: refreshStatus === 401 
            ? "Unauthorized - session expired" 
            : "Session refresh failed",
        }));
        return NextResponse.json(error, { status: refreshStatus === 401 ? 401 : 500 });
      }
    }

    // Handle non-401 responses
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: `Request failed with status ${response.status}`,
      }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    const nextResponse = NextResponse.json(data, { status: response.status });

    // Forward Set-Cookie headers from backend
    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      forwardCookies(setCookieHeaders, nextResponse);
    }

    return nextResponse;
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * Forward cookies from backend to Next.js response
 */
function forwardCookies(
  setCookieHeaders: string[],
  nextResponse: NextResponse,
): void {
  setCookieHeaders.forEach((cookieString) => {
    const parts = cookieString.split(";").map((p) => p.trim());
    const [nameValue] = parts;
    const [name, ...valueParts] = nameValue.split("=");
    const value = valueParts.join("=");

    const cookieOptions: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    } = {};

    parts.slice(1).forEach((part) => {
      const lowerPart = part.toLowerCase();
      if (lowerPart === "httponly") {
        cookieOptions.httpOnly = true;
      } else if (lowerPart === "secure") {
        cookieOptions.secure = true;
      } else if (lowerPart.startsWith("path=")) {
        cookieOptions.path = part.split("=")[1];
      } else if (lowerPart.startsWith("samesite=")) {
        const sameSiteValue = part.split("=")[1].toLowerCase();
        if (
          sameSiteValue === "lax" ||
          sameSiteValue === "strict" ||
          sameSiteValue === "none"
        ) {
          cookieOptions.sameSite = sameSiteValue as
            | "lax"
            | "strict"
            | "none";
        }
      } else if (lowerPart.startsWith("max-age=")) {
        cookieOptions.maxAge = parseInt(part.split("=")[1], 10);
      }
    });

    const isProduction = process.env.NODE_ENV === "production";
    nextResponse.cookies.set(name, value, {
      httpOnly: cookieOptions.httpOnly ?? true,
      secure: cookieOptions.secure ?? isProduction,
      sameSite: cookieOptions.sameSite || "lax",
      path: cookieOptions.path || "/",
      maxAge: cookieOptions.maxAge,
    });
  });
}
