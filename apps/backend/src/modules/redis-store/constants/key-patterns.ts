/**
 * Redis key naming conventions and TTL rules
 *
 * All keys follow the pattern: {store}:{type}:{identifier}
 */

export const KEY_PATTERNS = {
  /**
   * Inventory keys
   * Format: inventory:variant:{variantId}
   * TTL: None (persistent)
   */
  INVENTORY_VARIANT: (variantId: string) => `inventory:variant:${variantId}`,

  /**
   * Reserved inventory keys (aggregated per variant)
   * Format: inventory:reserved:{variantId}
   * TTL: None (persistent, managed separately)
   */
  INVENTORY_RESERVED: (variantId: string) => `inventory:reserved:${variantId}`,

  /**
   * Individual reservation keys (per cart/variant)
   * Format: inventory:reservation:{cartId}:{variantId}
   * TTL: 15 minutes (default), refreshed on cart updates
   */
  INVENTORY_RESERVATION: (cartId: string, variantId: string) =>
    `inventory:reservation:${cartId}:${variantId}`,

  /**
   * Cart keys for customers
   * Format: cart:customer:{customerId}
   * TTL: 30 days
   */
  CART_CUSTOMER: (customerId: string) => `cart:customer:${customerId}`,

  /**
   * Cart keys for sessions
   * Format: cart:session:{sessionId}
   * TTL: 30 days
   */
  CART_SESSION: (sessionId: string) => `cart:session:${sessionId}`,

  /**
   * Checkout session keys
   * Format: checkout:session:{sessionId}
   * TTL: 1 hour
   */
  CHECKOUT_SESSION: (sessionId: string) => `checkout:session:${sessionId}`,

  /**
   * Idempotency keys
   * Format: idempotency:{operation}:{key}
   * TTL: 24 hours
   */
  IDEMPOTENCY: (operation: string, key: string) =>
    `idempotency:${operation}:${key}`,

  /**
   * Checkout lock keys
   * Format: checkout:lock:{cartId}
   * TTL: 10 minutes (default)
   */
  CHECKOUT_LOCK: (cartId: string) => `checkout:lock:${cartId}`,

  /**
   * Checkout session by order ID (reverse lookup)
   * Format: checkout:session:by-order:{orderId}
   * TTL: Same as checkout session (1 hour)
   */
  CHECKOUT_SESSION_BY_ORDER: (orderId: string) =>
    `checkout:session:by-order:${orderId}`,

  /**
   * Payment intent keys
   * Format: payment:intent:{checkoutSessionId}
   * TTL: 24 hours (must not expire before checkout completion)
   */
  PAYMENT_INTENT: (checkoutSessionId: string) =>
    `payment:intent:${checkoutSessionId}`,

  /**
   * Payment intent by payment ID (reverse lookup)
   * Format: payment:intent:by-id:{paymentIntentId}
   * TTL: Same as payment intent (24 hours)
   */
  PAYMENT_INTENT_BY_ID: (paymentIntentId: string) =>
    `payment:intent:by-id:${paymentIntentId}`,

  /**
   * Checkout metadata keys
   * Format: checkout:metadata:{sessionId}
   * TTL: Same as checkout session (1 hour)
   */
  CHECKOUT_METADATA: (sessionId: string) => `checkout:metadata:${sessionId}`,

  /**
   * Order by payment intent (payment-scoped idempotency)
   * Format: order:payment:{provider}:{paymentIntentId}
   * TTL: 24 hours (same as payment intent)
   */
  ORDER_BY_PAYMENT: (provider: string, paymentIntentId: string) =>
    `order:payment:${provider}:${paymentIntentId}`,

  /**
   * Discount rules (all active discounts)
   * Format: discount:rules
   * TTL: None (persistent, updated on discount CRUD)
   */
  DISCOUNT_RULES: () => "discount:rules",

  /**
   * Discount eligibility sets (variant IDs eligible for discount)
   * Format: discount:eligibility:{discountId}
   * TTL: 24 hours (auto-refreshed by warmup worker)
   */
  DISCOUNT_ELIGIBILITY: (discountId: string) =>
    `discount:eligibility:${discountId}`,

  /**
   * Product mapping (collections, tags, variants for a product)
   * Format: mapping:product:{productId}
   * TTL: 24 hours
   */
  MAPPING_PRODUCT: (productId: string) => `mapping:product:${productId}`,

  /**
   * Variant mapping (product, collections, tags for a variant)
   * Format: mapping:variant:{variantId}
   * TTL: 24 hours
   */
  MAPPING_VARIANT: (variantId: string) => `mapping:variant:${variantId}`,

  /**
   * Collection mapping (products in collection)
   * Format: mapping:collection:{collectionId}
   * TTL: 24 hours
   */
  MAPPING_COLLECTION: (collectionId: string) =>
    `mapping:collection:${collectionId}`,

  /**
   * Tag mapping (products with tag)
   * Format: mapping:tag:{tagId}
   * TTL: 24 hours
   */
  MAPPING_TAG: (tagId: string) => `mapping:tag:${tagId}`,

  /**
   * Discount ruleset version (atomic counter)
   * Format: discount-ruleset-version
   * TTL: None (persistent)
   */
  DISCOUNT_RULESET_VERSION: () => "discount-ruleset-version",

  /**
   * Discount ruleset bundle (versioned)
   * Format: discount-ruleset-bundle:{version}
   * TTL: None (persistent, cleaned up by cleanup job)
   */
  DISCOUNT_RULESET_BUNDLE: (version: number) =>
    `discount-ruleset-bundle:${version}`,

  /**
   * Discount ruleset metadata (versioned)
   * Format: discount-ruleset-metadata:{version}
   * TTL: None (persistent, cleaned up by cleanup job)
   */
  DISCOUNT_RULESET_METADATA: (version: number) =>
    `discount-ruleset-metadata:${version}`,

  /**
   * Pricing ruleset version (atomic counter)
   * Format: pricing-ruleset-version
   * TTL: None (persistent)
   */
  PRICING_RULESET_VERSION: () => "pricing-ruleset-version",

  /**
   * Pricing ruleset bundle (versioned)
   * Format: pricing-ruleset-bundle:{version}
   * TTL: None (persistent, cleaned up by cleanup job)
   */
  PRICING_RULESET_BUNDLE: (version: number) =>
    `pricing-ruleset-bundle:${version}`,

  /**
   * Pricing ruleset metadata (versioned)
   * Format: pricing-ruleset-metadata:{version}
   * TTL: None (persistent, cleaned up by cleanup job)
   */
  PRICING_RULESET_METADATA: (version: number) =>
    `pricing-ruleset-metadata:${version}`,

  /**
   * Bundle definition (full bundle with sets and items)
   * Format: bundle:{bundleId}:definition
   * TTL: 24 hours
   */
  BUNDLE_DEFINITION: (bundleId: string) => `bundle:${bundleId}:definition`,

  /**
   * Bundle sets metadata
   * Format: bundle:{bundleId}:sets
   * TTL: 24 hours
   */
  BUNDLE_SETS: (bundleId: string) => `bundle:${bundleId}:sets`,

  /**
   * Bundle eligibility (variant IDs allowed in a set)
   * Format: bundle:{bundleId}:eligibility:{setId}
   * TTL: 24 hours
   */
  BUNDLE_ELIGIBILITY: (bundleId: string, setId: string) =>
    `bundle:${bundleId}:eligibility:${setId}`,

  /**
   * Soft reserved inventory counter (global per variant)
   * Format: inventory:soft_reserved:{variantId}
   * TTL: None (persistent, managed separately)
   */
  INVENTORY_SOFT_RESERVED: (variantId: string) =>
    `inventory:soft_reserved:${variantId}`,

  /**
   * Heartbeat keys (per cart)
   * Format: heartbeat:{cartId}
   * TTL: 2 minutes (refreshed on heartbeat)
   */
  HEARTBEAT: (cartId: string) => `heartbeat:${cartId}`,

  /**
   * Stale cart marker (per cart)
   * Format: cart:stale:{cartId}
   * TTL: 5 minutes (safety net)
   */
  CART_STALE: (cartId: string) => `cart:stale:${cartId}`,

  /**
   * Cart prefix for scanning
   * Format: cart:{cartId}
   */
  CART_PREFIX: () => `cart:`,

  /**
   * Inventory reservation prefix for scanning
   * Format: inventory:reservation:*
   */
  INVENTORY_RESERVATION_PREFIX: () => `inventory:reservation:`,

  /**
   * Fingerprint active reservations set
   * Format: fingerprint:reservations:{fingerprint}
   * TTL: 15 minutes (matches reservation TTL)
   */
  FINGERPRINT_RESERVATIONS: (fingerprint: string) =>
    `fingerprint:reservations:${fingerprint}`,

  /**
   * Stale item marker (per cart item)
   * Format: stale:item:{cartId}:{variantId}
   * TTL: 7 days (longer than cart expiry for recovery window)
   */
  STALE_ITEM: (cartId: string, variantId: string) =>
    `stale:item:${cartId}:${variantId}`,

  /**
   * FX exchange rate keys
   * Format: fx:rate:{fromCurrency}:{toCurrency}
   * TTL: 1 hour (configurable via FX_CACHE_TTL)
   */
  FX_RATE: (fromCurrency: string, toCurrency: string) =>
    `fx:rate:${fromCurrency}:${toCurrency}`,

  /**
   * Analytics order metrics keys
   * Format: analytics:orders:metrics:{periodHash}
   * TTL: Variable based on period (5 min for today, 15 min for week, 1 hour for month+)
   */
  ANALYTICS_ORDER_METRICS: (periodHash: string) =>
    `analytics:orders:metrics:${periodHash}`,

  /**
   * Analytics order status breakdown keys
   * Format: analytics:orders:status:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_ORDER_STATUS: (periodHash: string) =>
    `analytics:orders:status:${periodHash}`,

  /**
   * Analytics order trends keys
   * Format: analytics:orders:trends:{granularity}:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_ORDER_TRENDS: (granularity: string, periodHash: string) =>
    `analytics:orders:trends:${granularity}:${periodHash}`,

  /**
   * Analytics sales revenue keys
   * Format: analytics:sales:revenue:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_SALES_REVENUE: (periodHash: string) =>
    `analytics:sales:revenue:${periodHash}`,

  /**
   * Analytics sales by category keys
   * Format: analytics:sales:category:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_SALES_CATEGORY: (periodHash: string) =>
    `analytics:sales:category:${periodHash}`,

  /**
   * Analytics sales by payment method keys
   * Format: analytics:sales:payment:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_SALES_PAYMENT: (periodHash: string) =>
    `analytics:sales:payment:${periodHash}`,

  /**
   * Analytics customer segmentation keys
   * Format: analytics:customers:segmentation:{date}
   * TTL: 24 hours (pre-computed daily)
   */
  ANALYTICS_CUSTOMER_SEGMENTATION: (date: string) =>
    `analytics:customers:segmentation:${date}`,

  /**
   * Analytics RFM analysis keys
   * Format: analytics:customers:rfm:{date}
   * TTL: 24 hours (pre-computed daily/weekly)
   */
  ANALYTICS_CUSTOMER_RFM: (date: string) => `analytics:customers:rfm:${date}`,

  /**
   * Analytics top customers keys
   * Format: analytics:customers:top:{limit}:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_CUSTOMER_TOP: (limit: number, periodHash: string) =>
    `analytics:customers:top:${limit}:${periodHash}`,

  /**
   * Analytics top products keys
   * Format: analytics:products:top:{limit}:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_PRODUCT_TOP: (limit: number, periodHash: string) =>
    `analytics:products:top:${limit}:${periodHash}`,

  /**
   * Analytics category performance keys
   * Format: analytics:products:category:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_PRODUCT_CATEGORY: (periodHash: string) =>
    `analytics:products:category:${periodHash}`,

  /**
   * Analytics variant performance keys
   * Format: analytics:products:variants:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_PRODUCT_VARIANTS: (periodHash: string) =>
    `analytics:products:variants:${periodHash}`,

  /**
   * Analytics inventory turnover keys
   * Format: analytics:products:turnover:{periodHash}
   * TTL: Variable based on period
   */
  ANALYTICS_PRODUCT_TURNOVER: (periodHash: string) =>
    `analytics:products:turnover:${periodHash}`,
} as const;

/**
 * TTL values in seconds
 */
export const TTL = {
  /**
   * Cart expiration: 30 days
   */
  CART: 30 * 24 * 60 * 60, // 30 days in seconds

  /**
   * Checkout session expiration: 1 hour
   */
  CHECKOUT_SESSION: 60 * 60, // 1 hour in seconds

  /**
   * Idempotency key expiration: 24 hours
   */
  IDEMPOTENCY: 24 * 60 * 60, // 24 hours in seconds

  /**
   * Inventory reservation TTL: 15 minutes (default)
   * Used for temporary inventory reservations during checkout
   */
  INVENTORY_RESERVATION: 15 * 60, // 15 minutes in seconds

  /**
   * Checkout lock TTL: 10 minutes
   * Used to prevent concurrent checkout attempts on the same cart
   */
  CHECKOUT_LOCK: 10 * 60, // 10 minutes in seconds

  /**
   * Payment intent TTL: 24 hours
   * Must not expire before checkout completion
   */
  PAYMENT_INTENT: 24 * 60 * 60, // 24 hours in seconds

  /**
   * Checkout metadata TTL: 1 hour
   * Same as checkout session - metadata expires with session
   */
  CHECKOUT_METADATA: 60 * 60, // 1 hour in seconds

  /**
   * Order by payment TTL: 24 hours
   * Same as payment intent - used for payment-scoped idempotency
   */
  ORDER_BY_PAYMENT: 24 * 60 * 60, // 24 hours in seconds

  /**
   * Discount eligibility expiration: 24 hours
   */
  DISCOUNT_ELIGIBILITY: 24 * 60 * 60, // 24 hours in seconds

  /**
   * Product mapping expiration: 24 hours
   */
  PRODUCT_MAPPING: 24 * 60 * 60, // 24 hours in seconds

  /**
   * Bundle definition expiration: 24 hours
   */
  BUNDLE_DEFINITION: 24 * 60 * 60, // 24 hours in seconds

  /**
   * Bundle sets expiration: 24 hours
   */
  BUNDLE_SETS: 24 * 60 * 60, // 24 hours in seconds

  /**
   * Bundle eligibility expiration: 24 hours
   */
  BUNDLE_ELIGIBILITY: 24 * 60 * 60, // 24 hours in seconds

  /**
   * Stale item marker TTL: 7 days
   * Longer than cart expiry (30 days) to allow recovery window
   */
  STALE_ITEM: 7 * 24 * 60 * 60, // 7 days in seconds

  /**
   * FX exchange rate TTL: 1 hour (default)
   * Configurable via FX_CACHE_TTL environment variable
   */
  FX_RATE: parseInt(process.env.FX_CACHE_TTL || "3600", 10), // 1 hour in seconds
} as const;
