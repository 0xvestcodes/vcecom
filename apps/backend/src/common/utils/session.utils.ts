/**
 * Session ID extraction utilities
 * Extracts session ID from cookies (preferred) or headers (fallback)
 */

/**
 * Type for request objects that have cookies and headers
 * Compatible with Express Request, NestJS Request, and any object with cookies/headers properties
 * Uses unknown for headers to accept various header implementations (Headers from NestJS,
 * IncomingHttpHeaders from Express, plain objects) without using 'any' type.
 * Headers are properly narrowed inside the function using type guards.
 */
interface RequestLike {
  cookies?: { [key: string]: string } | undefined;
  headers?: unknown;
}

/**
 * Type guard to check if headers object has a get() method (NestJS Headers type)
 */
function hasGetMethod(
  headers: unknown,
): headers is { get: (name: string) => string | null } {
  return (
    typeof headers === "object" &&
    headers !== null &&
    "get" in headers &&
    typeof (headers as { get?: unknown }).get === "function"
  );
}

/**
 * Type guard to check if headers is a record-like object (Express IncomingHttpHeaders or plain object)
 */
function isHeadersRecord(
  headers: unknown,
): headers is Record<string, string | string[] | undefined> {
  return typeof headers === "object" && headers !== null;
}

/**
 * Extract session ID from request
 * Priority: cookies > headers
 * Accepts Express Request, NestJS Request, or any object with cookies and headers properties
 *
 * Based on NestJS patterns: https://stackoverflow.com/questions/69005343/how-do-i-get-a-request-header-using-nestjs
 *
 * @param req - Request object with cookies and/or headers
 * @returns Session ID string or null if not found
 */
export function extractSessionId(req: RequestLike): string | null {
  // Try cookie first (preferred for server actions)
  // Check both "session-id" (hyphen) and "session_id" (underscore) for compatibility
  const sessionIdFromCookie =
    req.cookies?.["session-id"] || req.cookies?.session_id;
  if (sessionIdFromCookie) {
    return sessionIdFromCookie;
  }

  // Fallback to header (for backward compatibility)
  const headers = req.headers;
  if (!headers) {
    return null;
  }

  // Handle Headers type (from NestJS) which has a get() method
  if (hasGetMethod(headers)) {
    const sessionId =
      headers.get("x-session-id") || headers.get("X-Session-Id");
    if (sessionId) {
      return sessionId;
    }
  }

  // Handle IncomingHttpHeaders and plain objects (Express Request, etc.)
  // IncomingHttpHeaders uses lowercase keys
  if (isHeadersRecord(headers)) {
    const sessionIdFromHeader =
      headers["x-session-id"] || headers["X-Session-Id"];

    if (sessionIdFromHeader) {
      // Handle both string and string[] types (IncomingHttpHeaders can return either)
      const headerValue = Array.isArray(sessionIdFromHeader)
        ? sessionIdFromHeader[0]
        : sessionIdFromHeader;
      if (typeof headerValue === "string") {
        return headerValue;
      }
    }
  }

  return null;
}
