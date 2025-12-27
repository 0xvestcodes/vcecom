/**
 * Environment variable validation and access
 * Validates required environment variables at build time and runtime
 */

const API_URL_PATTERN = /^https?:\/\/.+/;

/**
 * Check if we're in build time (Next.js build process)
 */
function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build" ||
    process.argv.some((arg) => arg.includes("next") && arg.includes("build"))
  );
}

/**
 * Validate that NEXT_PUBLIC_API_URL is set and is a valid URL
 * During build time, returns a default value instead of throwing
 */
function validateApiUrl(url: string | undefined, name: string): string {
  // During build time, allow builds to proceed with a placeholder
  // The actual validation will happen at runtime
  if (isBuildTime() && !url) {
    return "https://placeholder-api-url.com";
  }

  if (!url) {
    throw new Error(
      `Missing required environment variable: ${name}. Please set it in Vercel/Netlify project settings or .env file.`,
    );
  }

  if (!API_URL_PATTERN.test(url)) {
    throw new Error(
      `Invalid ${name} format: "${url}". Must be a valid HTTP/HTTPS URL (e.g., https://api.example.com)`,
    );
  }

  return url;
}

/**
 * Get the API base URL for client-side code
 * Validates the URL format and ensures it's set
 */
export function getPublicApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  return validateApiUrl(url, "NEXT_PUBLIC_API_URL");
}

/**
 * Get the API base URL for server-side code
 * Falls back to NEXT_PUBLIC_API_URL if API_URL is not set
 */
export function getServerApiUrl(): string {
  const url = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  return validateApiUrl(url, "API_URL or NEXT_PUBLIC_API_URL");
}

/**
 * Validate all required environment variables
 * Call this at the top of your app to fail fast if env vars are missing
 * Skips validation during build time to allow builds to proceed
 */
export function validateEnv(): void {
  // Skip validation during build time - Next.js needs to build without env vars
  if (isBuildTime()) {
    return;
  }

  if (typeof window === "undefined") {
    // Server-side validation (runtime only)
    getServerApiUrl();
  } else {
    // Client-side validation (runtime only)
    getPublicApiUrl();
  }
}

/**
 * Environment configuration object
 */
export const env = {
  /**
   * Backend API URL (public, used by client-side code)
   */
  get apiUrl() {
    return getPublicApiUrl();
  },

  /**
   * Backend API URL for server-side requests
   */
  get serverApiUrl() {
    return getServerApiUrl();
  },

  /**
   * Node environment
   */
  get nodeEnv() {
    return process.env.NODE_ENV || "production";
  },

  /**
   * Check if running in production
   */
  get isProduction() {
    return this.nodeEnv === "production";
  },

  /**
   * Check if running in development
   */
  get isDevelopment() {
    return this.nodeEnv === "development";
  },
} as const;
