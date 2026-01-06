import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Generate a new session ID for guest users
 */
export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Get or create session ID for guest cart
 * Creates a new session ID if one doesn't exist
 */
export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get("session_id")?.value;

  if (!sessionId) {
    sessionId = generateSessionId();
    cookieStore.set("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
  }

  return sessionId;
}

/**
 * Get session ID from cookies
 */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("session_id")?.value || null;
}
