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
