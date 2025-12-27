import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(_request: NextRequest) {
  try {
    // Get cookies from Next.js
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Forward request to backend
    const response = await fetch(`${API_URL}/admin/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Unauthorized" }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();

    // Create response with data
    const nextResponse = NextResponse.json(data, { status: 200 });

    // Forward Set-Cookie headers from backend (new tokens with rotation)
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
              cookieOptions.sameSite = sameSiteValue as
                | "lax"
                | "strict"
                | "none";
            }
          } else if (lowerPart.startsWith("max-age=")) {
            cookieOptions.maxAge = parseInt(part.split("=")[1], 10);
          }
        });

        // In production, cookies must be secure (HTTPS required)
        const isProduction = process.env.NODE_ENV === "production";
        nextResponse.cookies.set(name, value, {
          httpOnly: cookieOptions.httpOnly ?? true,
          secure: cookieOptions.secure ?? isProduction, // true in prod, false in dev
          sameSite: cookieOptions.sameSite || "lax",
          path: cookieOptions.path || "/",
          maxAge: cookieOptions.maxAge,
        });
      });
    }

    return nextResponse;
  } catch (error) {
    console.error("Refresh proxy error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
