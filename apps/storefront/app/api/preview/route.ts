import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Preview mode entry route
 * Sets preview_token cookie to enable preview mode
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");

  if (!token) {
    return NextResponse.json(
      { error: "Preview token is required" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("preview_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });

  // Redirect to the previewed page if slug is provided
  if (slug) {
    return NextResponse.redirect(new URL(slug, request.url));
  }

  return NextResponse.json({ success: true, message: "Preview mode enabled" });
}
