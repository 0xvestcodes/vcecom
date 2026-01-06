/**
 * API client using native fetch
 * No Axios needed - using fetch with proper error handling
 * Includes automatic token refresh on 401 errors
 */

import { getServerApiUrl } from "./env";

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

/**
 * Get the API base URL from environment or default to localhost
 * Client-side: uses Next.js proxy API route for centralized auth handling (except auth endpoints)
 * Server-side: uses backend URL directly
 */
function getApiBaseUrl(endpoint?: string): string {
  if (typeof window !== "undefined") {
    // Client-side: use Next.js proxy API route for non-auth endpoints
    // Auth endpoints (login, refresh, me, logout) use existing API routes that handle cookies specially
    const isAuthEndpoint =
      endpoint?.includes("/auth/login") ||
      endpoint?.includes("/auth/refresh") ||
      endpoint?.includes("/auth/me") ||
      endpoint?.includes("/auth/logout");

    if (!isAuthEndpoint) {
      // Use proxy for all non-auth endpoints
      return "/api/proxy";
    }
    // For auth endpoints, use existing API routes (they're at /api/auth/*, not /api/proxy/admin/auth/*)
    // Map /admin/auth/login -> /api/auth/login
    return "";
  }
  // Server-side: use backend URL directly
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
 * Fetch wrapper with error handling
 * Token refresh is handled by the proxy API route for client-side requests
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, skipAuthRefresh, storeId, ...fetchOptions } = options;

  const baseUrl = getApiBaseUrl(endpoint);
  const isClientSide = typeof window !== "undefined";

  // Build URL
  let url: string;
  if (isClientSide && baseUrl === "/api/proxy") {
    // Proxy route - endpoint is the backend path
    url = `${baseUrl}${endpoint}${params ? buildQueryString(params) : ""}`;
  } else if (isClientSide && baseUrl === "") {
    // Auth endpoint - map /admin/auth/* to /api/auth/*
    const authPath = endpoint.replace("/admin/auth/", "/auth/");
    url = `/api${authPath}${params ? buildQueryString(params) : ""}`;
  } else {
    // Server-side or direct backend URL
    url = `${baseUrl}${endpoint}${params ? buildQueryString(params) : ""}`;
  }

  const headers = createHeaders(fetchOptions.headers, storeId);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include", // Include httpOnly cookies
    });

    // Proxy handles 401 and refresh automatically for client-side requests
    // For server-side or if skipAuthRefresh is true, handle errors normally
    if (!response.ok) {
      // Handle 401 - proxy should have refreshed, but if we still get 401, session is expired
      if (response.status === 401) {
        // Only redirect if client-side and not skipping refresh
        if (isClientSide && !skipAuthRefresh) {
          const currentPath = window.location.pathname;
          if (!currentPath.includes("/login")) {
            const loginUrl = new URL("/login", window.location.origin);
            loginUrl.searchParams.set("expired", "true");
            loginUrl.searchParams.set("redirect", currentPath);
            window.location.href = loginUrl.toString();
            // Return a promise that never resolves to prevent further execution
            return new Promise(() => {}) as T;
          }
        }
      }

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
