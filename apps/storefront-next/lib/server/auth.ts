import { cookies } from "next/headers";
import { serverApiFetch } from "./api";

export interface CustomerSession {
  id: string;
  email: string;
  name?: string;
  phone?: string;
}

/**
 * Get current customer session from backend
 * Returns null if not authenticated
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  try {
    const session = await serverApiFetch<CustomerSession>(
      "/store/customers/me",
    );
    return session;
  } catch (_error) {
    return null;
  }
}

/**
 * Check if customer is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCustomerSession();
  return session !== null;
}

/**
 * Get session ID from cookies (for guest cart)
 */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id");
  return sessionId?.value || null;
}
