import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Security Headers Middleware
 * Adds comprehensive security headers to all responses
 */
export function addSecurityHeaders(_request: NextRequest): NextResponse {
  const response = NextResponse.next();

  const isProduction = process.env.NODE_ENV === "production";

  // Strict-Transport-Security (HSTS)
  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // X-Content-Type-Options
  response.headers.set("X-Content-Type-Options", "nosniff");

  // X-Frame-Options
  response.headers.set("X-Frame-Options", "DENY");

  // X-XSS-Protection
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer-Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy (formerly Feature-Policy)
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  );

  // Content-Security-Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for some Next.js features
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // X-DNS-Prefetch-Control
  response.headers.set("X-DNS-Prefetch-Control", "on");

  // Expect-CT (Certificate Transparency)
  if (isProduction) {
    response.headers.set("Expect-CT", "max-age=86400, enforce");
  }

  return response;
}
