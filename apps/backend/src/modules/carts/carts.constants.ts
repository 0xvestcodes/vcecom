/**
 * Cart management constants
 * Configuration values specific to cart operations
 */

/**
 * Cart expiration period in days
 * Carts are automatically cleaned up after this period of inactivity
 */
export const CART_EXPIRY_DAYS = 30;

/**
 * Cart expiry hours for cleanup service
 * Carts expire after this many hours of inactivity
 */
export const CART_EXPIRY_HOURS = 24;

/**
 * Committed cart items archive period in days
 * Archive committed items after this period
 */
export const COMMITTED_ARCHIVE_DAYS = 30;

/**
 * Abandoned cart detection configuration
 */
export const ABANDONED_CART_DETECTION_HOURS = parseInt(
  process.env.ABANDONED_CART_DETECTION_HOURS || "1",
  10,
);

export const ABANDONED_CART_MIN_VALUE = parseFloat(
  process.env.ABANDONED_CART_MIN_VALUE || "0",
);

export const RECOVERY_EMAIL_DELAY_HOURS = parseInt(
  process.env.RECOVERY_EMAIL_DELAY_HOURS || "1",
  10,
);

export const RECOVERY_SMS_DELAY_HOURS = parseInt(
  process.env.RECOVERY_SMS_DELAY_HOURS || "2",
  10,
);

export const MAX_RECOVERY_ATTEMPTS = parseInt(
  process.env.MAX_RECOVERY_ATTEMPTS || "3",
  10,
);

export const RECOVERY_DISCOUNT_PERCENTAGE = parseInt(
  process.env.RECOVERY_DISCOUNT_PERCENTAGE || "10",
  10,
);
