import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Exit preview mode route
 * Clears preview_token cookie
 */
export async function GET(_request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("preview_token");

  return NextResponse.json({ success: true, message: "Preview mode disabled" });
}
