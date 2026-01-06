import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Forward Set-Cookie headers from backend response to Next.js response
 */
function forwardCookies(response: Response, nextResponse: NextResponse): void {
  const setCookieHeaders = response.headers.getSetCookie();

  if (setCookieHeaders && setCookieHeaders.length > 0) {
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
            cookieOptions.sameSite = sameSiteValue as "lax" | "strict" | "none";
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
}

/**
 * Get cookie header from Next.js cookies
 */
export async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/**
 * Proxy request to backend API
 */
export async function proxyRequest(
  endpoint: string,
  _request: NextRequest,
  options: {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
  } = {},
): Promise<NextResponse> {
  try {
    const { method = "GET", body, headers: customHeaders } = options;
    const cookieHeader = await getCookieHeader();

    const headers = new Headers(customHeaders);
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }
    if (body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: "include",
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);
    const data = await response.json().catch(() => ({}));

    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    forwardCookies(response, nextResponse);

    return nextResponse;
  } catch (error) {
    console.error(`Proxy error for ${endpoint}:`, error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
