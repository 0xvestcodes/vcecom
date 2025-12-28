/**
 * Custom API error class that preserves full error response data
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Checkout inventory error - specific error type for inventory-related checkout failures
 */
export interface CheckoutInventoryError {
  message: string;
  failures: Array<{
    variantId: string;
    requested: number;
    available: number;
  }>;
  adjustedCart?: unknown;
}

export function isCheckoutInventoryError(
  error: unknown,
): error is ApiError & { data: CheckoutInventoryError } {
  if (!(error instanceof ApiError) || !error.data) {
    return false;
  }

  const data = error.data as unknown;

  // Check if data field contains structured error (from backend exception filter)
  if (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    typeof (data as { data: unknown }).data === "object" &&
    (data as { data: unknown }).data !== null &&
    "failures" in ((data as { data: unknown }).data as object) &&
    Array.isArray(
      ((data as { data: unknown }).data as CheckoutInventoryError).failures,
    )
  ) {
    return true;
  }

  // Check if data itself has failures (direct structure)
  if (
    typeof data === "object" &&
    data !== null &&
    "failures" in data &&
    Array.isArray((data as CheckoutInventoryError).failures)
  ) {
    return true;
  }

  // Check if message field contains the structured error (NestJS serialization)
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "object" &&
    (data as { message: unknown }).message !== null &&
    "failures" in ((data as { message: unknown }).message as object) &&
    Array.isArray(
      ((data as { message: unknown }).message as CheckoutInventoryError)
        .failures,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Extract checkout inventory error data from an ApiError
 */
export function extractCheckoutInventoryError(
  error: ApiError,
): CheckoutInventoryError | null {
  if (!isCheckoutInventoryError(error)) {
    return null;
  }

  const data = error.data as unknown;

  // Check data field first (from backend exception filter)
  if (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    typeof (data as { data: unknown }).data === "object" &&
    (data as { data: unknown }).data !== null &&
    "failures" in ((data as { data: unknown }).data as object)
  ) {
    return (data as { data: CheckoutInventoryError }).data;
  }

  // Direct structure
  if (
    typeof data === "object" &&
    data !== null &&
    "failures" in data &&
    Array.isArray((data as CheckoutInventoryError).failures)
  ) {
    return data as CheckoutInventoryError;
  }

  // Nested in message field
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "object" &&
    (data as { message: unknown }).message !== null &&
    "failures" in ((data as { message: unknown }).message as object)
  ) {
    return (data as { message: CheckoutInventoryError }).message;
  }

  return null;
}
