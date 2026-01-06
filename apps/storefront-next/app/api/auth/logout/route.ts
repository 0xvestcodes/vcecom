import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(_request: NextRequest) {
  try {
    // Forward the request to backend
    const _response = await fetch(`${API_URL}/store/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    const nextResponse = NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 },
    );

    // Clear auth cookies
    nextResponse.cookies.delete("access_token");
    nextResponse.cookies.delete("refresh_token");

    return nextResponse;
  } catch (error) {
    console.error("Logout proxy error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
