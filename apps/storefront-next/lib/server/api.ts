import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

/**
 * Server-side API client for Server Components and Server Actions
 * Automatically forwards cookies for authentication
 */
export async function serverApiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit & {
    params?: Record<string, string | number | boolean | undefined>;
    headers?: HeadersInit;
  } = {},
): Promise<T> {
  const { params, headers: customHeaders, ...fetchOptions } = options;

  // Build URL with query params
  const url = new URL(`${API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Get cookies from Next.js
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Create headers
  const headers = new Headers(customHeaders);
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }
  if (!headers.has("Content-Type") && fetchOptions.body) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url.toString(), {
      ...fetchOptions,
      headers,
      credentials: "include",
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
 * Parse error response from API
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let errors: Record<string, string[]> | undefined;

  try {
    const data = await response.json();
    message = data.message || message;
    errors = data.errors;
  } catch {
    // Response is not JSON, use default message
  }

  return {
    message,
    status: response.status,
    errors,
  };
}
