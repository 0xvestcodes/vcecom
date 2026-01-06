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
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 5000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Product detail pages - high cache hit rate
   */
  PRODUCT_DETAIL: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 100000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Reviews listing - moderate traffic
   */
  REVIEWS_LISTING: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 60000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Bundle listing - high throughput
   */
  BUNDLE_LISTING: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 100000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Categories, tags, search - moderate traffic
   */
  CATEGORIES_SEARCH: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 800000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Checkout session creation - tighter limits to prevent abuse
   */
  CHECKOUT_SESSION: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 5000,
    window: 300, // 5 minutes
    keyType: "sessionId" as RateLimitKeyType,
  },

  /**
   * Payment intent creation - strictest checkout limit
   */
  PAYMENT_INTENT: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 3000,
    window: 300, // 5 minutes
    keyType: "sessionId" as RateLimitKeyType,
  },

  /**
   * Cart updates - moderate limits
   */
  CART_UPDATES: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 3000,
    window: 300, // 5 minutes
    keyType: "sessionId" as RateLimitKeyType,
  },

  /**
   * Cart heartbeat - frequent keep-alive signals
   */
  CART_HEARTBEAT: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 120, // 2 per second in prod
    window: 60, // 1 minute
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
   * Admin GET endpoints - high limit for admin UI operations
   */
  ADMIN_GET: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 10000, // 10k requests per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Admin POST/PATCH/DELETE - moderate limit for mutations
   */
  ADMIN_MUTATE: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 1000, // 1k mutations per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Admin WRITE - alias for ADMIN_MUTATE
   */
  ADMIN_WRITE: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 1000, // 1k mutations per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Admin POST - moderate limit for POST mutations
   */
  ADMIN_POST: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 1000, // 1k mutations per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Admin PATCH - moderate limit for PATCH mutations
   */
  ADMIN_PATCH: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 1000, // 1k mutations per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Admin DELETE - moderate limit for DELETE mutations
   */
  ADMIN_DELETE: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 1000, // 1k mutations per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Generic read endpoint preset - for general GET operations
   */
  READ: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 10000, // 10k requests per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Generic write endpoint preset - for general POST/PUT operations
   */
  WRITE: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 1000, // 1k mutations per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "sessionId" as RateLimitKeyType,
  },

  /**
   * Generic CREATE endpoint preset - for POST operations
   */
  CREATE: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 1000, // 1k creations per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "sessionId" as RateLimitKeyType,
  },

  /**
   * Generic GET endpoint preset - for GET operations
   */
  GET: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 10000, // 10k requests per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Generic store GET - catch-all fallback for public GET endpoints
   */
  GENERIC_STORE_GET: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 150000,
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Export endpoints - strict limits in production, relaxed in development
   */
  EXPORT: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 5000,
    window: 60, // 1 minute
    keyType: "userId" as RateLimitKeyType,
  },

  /**
   * Webhook endpoints - IP-based rate limiting to prevent DoS
   */
  WEBHOOK: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 100, // 100 requests per minute in production
    window: 60, // 1 minute
    keyType: "ip" as RateLimitKeyType,
  },

  /**
   * Public GET endpoints - generic public read operations
   */
  PUBLIC_GET: {
    limit: isDevelopment ? Number.MAX_SAFE_INTEGER : 10000, // 10k requests per 5 minutes in production
    window: 300, // 5 minutes
    keyType: "ip" as RateLimitKeyType,
  },
} as const;
