/**
 * Rate limit configuration presets for different endpoint types
 * Values are tuned for production traffic: 1-5K DAU, CDN caching, mobile apps
 * In development mode, limits are significantly increased for easier testing
 */

export type RateLimitKeyType = "ip" | "sessionId" | "userId" | "ip+email";

export interface RateLimitConfig {
  limit: number;
  window: number; // in seconds
  keyType: RateLimitKeyType;
  skipIfAuthenticated?: boolean;
}

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Rate limit presets for different endpoint categories
 */
export const RATE_LIMIT_PRESETS = {
  /**
   * Storefront GET endpoints - high throughput for browsing
   */
  STOREFRONT_GET: {
    limit: isDevelopment ? 50000 : 5000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Product detail pages - high cache hit rate
   */
  PRODUCT_DETAIL: {
    limit: 100000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Reviews listing - moderate traffic
   */
  REVIEWS_LISTING: {
    limit: 60000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Bundle listing - high throughput
   */
  BUNDLE_LISTING: {
    limit: 100000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Categories, tags, search - moderate traffic
   */
  CATEGORIES_SEARCH: {
    limit: 800000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Checkout session creation - tighter limits to prevent abuse
   */
  CHECKOUT_SESSION: {
    limit: isDevelopment ? 20000 : 5000,
    window: 300, // 5 minutes
    keyType: "sessionId" as RateLimitKeyType,
  },

  /**
   * Payment intent creation - strictest checkout limit
   */
  PAYMENT_INTENT: {
    limit: isDevelopment ? 10000 : 3000,
    window: 300, // 5 minutes
    keyType: "sessionId" as RateLimitKeyType,
  },

  /**
   * Cart updates - moderate limits
   */
  CART_UPDATES: {
    limit: isDevelopment ? 10000 : 3000,
    window: 300, // 5 minutes
    keyType: "sessionId" as RateLimitKeyType,
  },

  /**
   * Login attempts - strict for brute force protection
   */
  LOGIN: {
    limit: isDevelopment ? 10000 : 1000,
    window: isDevelopment ? 300 : 600, // 5 min in dev, 10 min in prod
    keyType: "ip+email" as RateLimitKeyType,
  },

  /**
   * Reset password - strict for security
   */
  RESET_PASSWORD: {
    limit: isDevelopment ? 5000 : 800,
    window: isDevelopment ? 300 : 600, // 5 min in dev, 10 min in prod
    keyType: "ip+email" as RateLimitKeyType,
  },

  /**
   * Claim account - strict for security
   */
  CLAIM_ACCOUNT: {
    limit: isDevelopment ? 5000 : 800,
    window: isDevelopment ? 300 : 600, // 5 min in dev, 10 min in prod
    keyType: "ip+email" as RateLimitKeyType,
  },

  /**
   * Admin GET endpoints - unlimited for admin UI (temporarily set to infinity)
   */
  ADMIN_GET: {
    limit: Number.MAX_SAFE_INTEGER, // Effectively unlimited
    window: 300, // 5 minutes
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Admin POST/PATCH/DELETE - unlimited (temporarily set to infinity)
   */
  ADMIN_MUTATE: {
    limit: Number.MAX_SAFE_INTEGER, // Effectively unlimited
    window: 300, // 5 minutes
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Generic store GET - catch-all fallback for public GET endpoints
   */
  GENERIC_STORE_GET: {
    limit: 150000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Export endpoints - strict limits (5 per minute)
   */
  EXPORT: {
    limit: isDevelopment ? 20000 : 5000,
    window: 60, // 1 minute
    keyType: "userId" as RateLimitKeyType,
  },
} as const;
