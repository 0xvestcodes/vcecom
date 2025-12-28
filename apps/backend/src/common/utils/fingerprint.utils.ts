import { createHash } from "node:crypto";

/**
 * Generate device fingerprint from request headers
 * Uses User-Agent + IP + Accept headers for uniqueness
 *
 * @param userAgent - User-Agent header value
 * @param ip - Client IP address
 * @param accept - Accept header value (optional)
 * @returns SHA-256 hash of the fingerprint components
 */
export function generateDeviceFingerprint(
  userAgent: string | undefined,
  ip: string,
  accept?: string | undefined,
): string {
  // Normalize inputs
  const normalizedUserAgent = (userAgent || "unknown").toLowerCase().trim();
  const normalizedIp = ip.toLowerCase().trim();
  const normalizedAccept = (accept || "unknown").toLowerCase().trim();

  // Combine fingerprint components
  const fingerprintString = `${normalizedUserAgent}|${normalizedIp}|${normalizedAccept}`;

  // Generate SHA-256 hash
  const hash = createHash("sha256");
  hash.update(fingerprintString);
  return hash.digest("hex");
}

/**
 * Extract fingerprint components from request headers
 *
 * @param headers - Request headers object
 * @param ip - Client IP address
 * @returns Object with fingerprint components
 */
export function extractFingerprintComponents(
  headers: Record<string, string | string[] | undefined>,
  ip: string,
): {
  userAgent: string | undefined;
  ip: string;
  accept: string | undefined;
} {
  // Extract User-Agent
  const userAgent = Array.isArray(headers["user-agent"])
    ? headers["user-agent"][0]
    : headers["user-agent"];

  // Extract Accept header
  const accept = Array.isArray(headers.accept)
    ? headers.accept[0]
    : headers.accept;

  return {
    userAgent: typeof userAgent === "string" ? userAgent : undefined,
    ip,
    accept: typeof accept === "string" ? accept : undefined,
  };
}
