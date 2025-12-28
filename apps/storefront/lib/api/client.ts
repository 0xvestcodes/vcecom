/**
 * API client setup with interceptors for auth headers
 */

import { getGuestSessionId, getToken } from "../utils/storage";
import { endpoints } from "./endpoints";
import { ApiError } from "./errors";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Create fetch options with auth headers
 */
function createFetchOptions(options: RequestInit = {}): RequestInit {
  const headers = new Headers(options.headers);

  // Set content type if body is present and not already set
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Add JWT token if authenticated
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Add guest session ID for cart/checkout operations
  const guestSessionId = getGuestSessionId();
  headers.set("X-Session-Id", guestSessionId);

  return {
    ...options,
    headers,
  };
}

/**
 * API client with error handling
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const fetchOptions = createFetchOptions(options);

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    let errorData: unknown;

    try {
      errorData = await response.json();
      errorMessage =
        (errorData as { message?: string; error?: string }).message ||
        (errorData as { message?: string; error?: string }).error ||
        errorMessage;
    } catch {
      // If response is not JSON, use default error message
      errorData = undefined;
    }

    throw new ApiError(errorMessage, response.status, errorData);
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

/**
 * GET request helper
 */
export function get<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: "GET",
  });
}

/**
 * POST request helper
 */
export function post<T>(
  endpoint: string,
  data?: unknown,
  options?: RequestInit,
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request helper
 */
export function put<T>(
  endpoint: string,
  data?: unknown,
  options?: RequestInit,
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request helper
 */
export function patch<T>(
  endpoint: string,
  data?: unknown,
  options?: RequestInit,
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request helper
 */
export function del<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: "DELETE",
  });
}

export { endpoints };
