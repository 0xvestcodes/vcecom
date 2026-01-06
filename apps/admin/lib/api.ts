/**
 * API client using native fetch
 * No Axios needed - using fetch with proper error handling
 * Includes automatic token refresh on 401 errors
 */

import { getPublicApiUrl, getServerApiUrl } from "./env";

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

export class FetchError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.errors = errors;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuthRefresh?: boolean; // Skip automatic token refresh for this request
  storeId?: string; // Optional store ID to override default
}

// Token refresh state management
let refreshPromise: Promise<boolean> | null = null;
let isRefreshing = false;

/**
 * Get the API base URL from environment or default to localhost
 * Uses validated environment variables in production
 */
function getApiBaseUrl(): string {
  // Always use backend URL directly - no proxies needed
  // Backend handles CORS and cookies directly
  if (typeof window !== "undefined") {
    // Client-side: use NEXT_PUBLIC_API_URL for direct backend calls
    // In production, this will be validated and throw if missing
    if (process.env.NODE_ENV === "production") {
      return getPublicApiUrl();
    }
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  }
  // Server-side: use env variable or default
  if (process.env.NODE_ENV === "production") {
    return getServerApiUrl();
  }
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

/**
 * Build query string from params object
 */
function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Get auth token from cookies or localStorage
 * httpOnly cookies are sent automatically by browser
 * This checks Authorization header as fallback
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // Check localStorage as fallback (primary auth is via httpOnly cookies)
  return localStorage.getItem("admin_access_token");
}

/**
 * Get store ID from localStorage
 * Returns null if not available (backend will use default)
 */
function getStoreId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_store_id");
}

/**
 * Set store ID in localStorage
 * Called after successful store fetch
 */
export function setStoreId(storeId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("admin_store_id", storeId);
  }
}

/**
 * Fetch and cache store ID from backend
 * Can be called after login or when needed
 */
export async function fetchAndCacheStoreId(): Promise<string | null> {
  try {
    const store = await apiFetch<{ id: string }>("/admin/store");
    if (store?.id) {
      setStoreId(store.id);
      return store.id;
    }
  } catch (error) {
    console.warn("Failed to fetch store ID:", error);
  }
  return null;
}

/**
 * Create headers with auth token and store ID
 * Note: httpOnly cookies are sent automatically by browser
 * This adds Authorization header as fallback
 */
function createHeaders(init?: HeadersInit, storeIdOverride?: string): Headers {
  const headers = new Headers(init);

  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Add store ID header if available
  // If not provided, backend middleware will use default store
  const storeId = storeIdOverride || getStoreId();
  if (storeId) {
    headers.set("x-store-id", storeId);
  }

  // Only set Content-Type if not already set and body exists
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

/**
 * Server-side fetch with cookie forwarding
 * Used in server components and API routes
 */
export async function serverApiFetch<T = unknown>(
  endpoint: string,
  options: RequestOptions & { cookies?: string } = {},
): Promise<T> {
  const { params, cookies, storeId, ...fetchOptions } = options;

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}${params ? buildQueryString(params) : ""}`;

  const headers = createHeaders(fetchOptions.headers, storeId);

  // Forward cookies for server-side requests
  if (cookies) {
    headers.set("Cookie", cookies);
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include", // Include cookies
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw new FetchError(error.message, error.status, error.errors);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    return undefined as T;
  } catch (error) {
    if (error instanceof FetchError) {
      throw error;
    }

    throw new FetchError(
      error instanceof Error ? error.message : "Network error occurred",
      0,
    );
  }
}

/**
 * Parse error response
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let errors: Record<string, string[]> | undefined;

  try {
    const data = await response.json();
    message = data.message || data.error || message;
    errors = data.errors;
  } catch {
    // If response is not JSON, use status text
    message = response.statusText || message;
  }

  return {
    message,
    status: response.status,
    errors,
  };
}

/**
 * Refresh access token using refresh token
 * Returns true if refresh was successful, false otherwise
 */
async function refreshAccessToken(): Promise<boolean> {
  // If already refreshing, wait for that promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // Start refresh process
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      // Check if refresh token cookie exists before attempting refresh
      if (typeof window !== "undefined") {
        const hasRefreshToken = document.cookie.includes("admin_refresh_token");
        if (!hasRefreshToken) {
          // No refresh token - session truly expired
          const currentPath = window.location.pathname;
          if (!currentPath.includes("/login")) {
            const loginUrl = new URL("/login", window.location.origin);
            loginUrl.searchParams.set("expired", "true");
            loginUrl.searchParams.set("redirect", currentPath);
            window.location.href = loginUrl.toString();
          }
          return false;
        }
      }

      const baseUrl = getApiBaseUrl();
      // Use the refresh endpoint - cookies are sent automatically
      const response = await fetch(`${baseUrl}/admin/auth/refresh`, {
        method: "POST",
        credentials: "include", // Include httpOnly cookies
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // Check if refresh token is expired (401) vs other errors
        const isTokenExpired = response.status === 401;

        if (typeof window !== "undefined") {
          // Clear any stored tokens
          localStorage.removeItem("admin_access_token");
          localStorage.removeItem("admin_refresh_token");

          // Only redirect with "expired" if token is actually expired (401)
          // For other errors (network, 500, etc.), redirect without expired flag
          const currentPath = window.location.pathname;
          if (!currentPath.includes("/login")) {
            const loginUrl = new URL("/login", window.location.origin);
            if (isTokenExpired) {
              loginUrl.searchParams.set("expired", "true");
            } else {
              // Other error - show generic error message
              loginUrl.searchParams.set("error", "refresh_failed");
            }
            loginUrl.searchParams.set("redirect", currentPath);
            window.location.href = loginUrl.toString();
          }
        }
        return false;
      }

      // Refresh successful - cookies are updated automatically by browser
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();

        // Update localStorage token if provided (fallback)
        if (data.accessToken && typeof window !== "undefined") {
          localStorage.setItem("admin_access_token", data.accessToken);
        }
      }

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      // Network or other errors - don't redirect immediately
      // Let the calling code handle the error (might be transient)
      // Only return false so caller can decide what to do
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Fetch wrapper with error handling and automatic token refresh
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, skipAuthRefresh, storeId, ...fetchOptions } = options;

  const baseUrl = getApiBaseUrl();
  // Always use backend URL directly - no Next.js API route proxies
  const url = `${baseUrl}${endpoint}${params ? buildQueryString(params) : ""}`;

  const headers = createHeaders(fetchOptions.headers, storeId);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include", // Include httpOnly cookies
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && !skipAuthRefresh) {
      // Don't refresh if this is already a refresh request or login request
      if (
        endpoint.includes("/auth/refresh") ||
        endpoint.includes("/auth/login")
      ) {
        const error = await parseErrorResponse(response);
        throw new FetchError(error.message, error.status, error.errors);
      }

      // Attempt to refresh token
      const refreshSuccess = await refreshAccessToken();

      if (refreshSuccess) {
        // Retry original request with new token
        const retryHeaders = createHeaders(fetchOptions.headers, storeId);
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: retryHeaders,
          credentials: "include",
        });

        if (!retryResponse.ok) {
          const error = await parseErrorResponse(retryResponse);
          throw new FetchError(error.message, error.status, error.errors);
        }

        // Handle empty responses
        const contentType = retryResponse.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          return await retryResponse.json();
        }

        return undefined as T;
      } else {
        // Refresh failed - check if refresh token still exists
        // If it exists, might be a transient error - throw error instead of redirecting
        // If it doesn't exist, session is truly expired - redirect handled by refreshAccessToken
        if (typeof window !== "undefined") {
          const hasRefreshToken = document.cookie.includes("admin_refresh_token");
          if (hasRefreshToken) {
            // Refresh token exists but refresh failed - might be transient
            // Throw error instead of redirecting - let UI handle it
            const error = await parseErrorResponse(response);
            throw new FetchError(
              "Session refresh failed. Please try again.",
              error.status,
              error.errors,
            );
          }
          // No refresh token - refreshAccessToken already redirected
          // Return a promise that never resolves to prevent further execution
          return new Promise(() => {}) as T;
        }
        // Server-side or no window - throw error
        const error = await parseErrorResponse(response);
        throw new FetchError(error.message, error.status, error.errors);
      }
    }

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw new FetchError(error.message, error.status, error.errors);
    }

    // Handle empty responses
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    return undefined as T;
  } catch (error) {
    if (error instanceof FetchError) {
      throw error;
    }

    // Network or other errors
    throw new FetchError(
      error instanceof Error ? error.message : "Network error occurred",
      0,
    );
  }
}

/**
 * Convenience methods for HTTP verbs
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" }),

  post: <T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
};
