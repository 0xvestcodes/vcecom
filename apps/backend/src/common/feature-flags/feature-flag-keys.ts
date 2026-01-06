/**
 * Feature flag keys - centralized constants for type safety
 * All non-standard ecommerce features are gated behind feature flags
 * All flags default to false (OFF) - must be explicitly enabled by admin
 */

// ============================================================================
// 1. Advanced Catalog Features
// ============================================================================
export const ADVANCED_CATALOG_FLAGS = {
  PRODUCT_BUNDLES: "product_bundles",
  PRODUCT_CHOICE_SETS: "product_choice_sets",
  PRODUCT_ASSOCIATIONS: "product_associations",
  PRODUCT_CROSS_SELL: "product_cross_sell",
  PRODUCT_UPSELL: "product_upsell",
  COLLECTIONS_MODULE: "collections_module",
  ADVANCED_SEARCH_ENGINE: "advanced_search_engine",
  SEARCH_MEILISEARCH: "search_meilisearch",
  SEARCH_ELASTICSEARCH: "search_elasticsearch",
  SEARCH_OPENSEARCH: "search_opensearch",
  PRODUCT_IMPORTS: "product_imports",
  PRODUCT_EXPORTS: "product_exports",
} as const;

// ============================================================================
// 2. Pricing & Discounts
// ============================================================================
export const PRICING_DISCOUNTS_FLAGS = {
  ADVANCED_PRICING_ENGINE: "advanced_pricing_engine",
  PRICE_LISTS: "price_lists",
  CUSTOMER_SPECIFIC_PRICING: "customer_specific_pricing",
  B2B_PRICING_MODE: "b2b_pricing_mode",
  CURRENCY_SPECIFIC_PRICING: "currency_specific_pricing",
  DISCOUNT_ENGINE_V2: "discount_engine_v2",
  DISCOUNT_STACKING: "discount_stacking",
  DISCOUNT_PRIORITIES: "discount_priorities",
  CUSTOMER_GROUP_DISCOUNTS: "customer_group_discounts",
} as const;

// ============================================================================
// 3. Tax & GST Advanced
// ============================================================================
export const TAX_GST_ADVANCED_FLAGS = {
  GST_ENGINE_FULL_MODE: "gst_engine_full_mode",
  HSN_CODE_ENFORCEMENT: "hsn_code_enforcement",
  TAX_RULE_OVERRIDES: "tax_rule_overrides",
  MULTI_LEVEL_TAX_RULES: "multi_level_tax_rules",
  TAX_EXEMPTION_SYSTEM: "tax_exemption_system",
  TAX_AUDIT_LOGS: "tax_audit_logs",
} as const;

// ============================================================================
// 4. Payment Extensions
// ============================================================================
export const PAYMENT_EXTENSIONS_FLAGS = {
  PAYMENT_METHOD_CHARGES: "payment_method_charges",
  WALLET_PAYMENTS: "wallet_payments",
  LOYALTY_POINTS_SYSTEM: "loyalty_points_system",
  COD_RESTRICTIONS: "cod_restrictions",
} as const;

// ============================================================================
// 5. Checkout & Recovery
// ============================================================================
export const CHECKOUT_RECOVERY_FLAGS = {
  ABANDONED_CART_RECOVERY: "abandoned_cart_recovery",
  ABANDONED_CART_EMAIL: "abandoned_cart_email",
  ABANDONED_CART_SMS: "abandoned_cart_sms",
  ABANDONED_CHECKOUT_TRACKING: "abandoned_checkout_tracking",
  MULTI_CURRENCY_CHECKOUT: "multi_currency_checkout",
} as const;

// ============================================================================
// 6. Shipping & Fulfillment
// ============================================================================
export const SHIPPING_FULFILLMENT_FLAGS = {
  SHIPROCKET_INTEGRATION: "shiprocket_integration",
  NIMBUSPOST_INTEGRATION: "nimbuspost_integration",
  PIN_CODE_SERVICEABILITY: "pin_code_serviceability",
  REAL_TIME_SHIPPING_RATES: "real_time_shipping_rates",
  LABEL_GENERATION: "label_generation",
  ORDER_TRACKING: "order_tracking",
} as const;

// ============================================================================
// 7. Inventory & Returns
// ============================================================================
export const INVENTORY_RETURNS_FLAGS = {
  LOW_STOCK_ALERTS: "low_stock_alerts",
  INVENTORY_RESERVATIONS: "inventory_reservations",
  BULK_INVENTORY_TOOLS: "bulk_inventory_tools",
  RETURN_MANAGEMENT: "return_management",
  RMA_GENERATION: "rma_generation",
} as const;

// ============================================================================
// 8. Customer Growth & Segmentation
// ============================================================================
export const CUSTOMER_GROWTH_FLAGS = {
  CUSTOMER_GROUPS: "customer_groups",
  CUSTOMER_SEGMENTATION: "customer_segmentation",
  LOYALTY_SYSTEM: "loyalty_system",
  WALLET_SYSTEM: "wallet_system",
} as const;

// ============================================================================
// 9. CMS & Theme
// ============================================================================
export const CMS_THEME_FLAGS = {
  CMS_BUILDER: "cms_builder",
  CMS_BLOCKS: "cms_blocks",
  THEME_CUSTOMIZER: "theme_customizer",
  BLOG_MODULE: "blog_module",
} as const;

// ============================================================================
// 10. Analytics
// ============================================================================
export const ANALYTICS_FLAGS = {
  ADVANCED_ANALYTICS_DASHBOARD: "advanced_analytics_dashboard",
  SEARCH_ANALYTICS: "search_analytics",
  PERFORMANCE_ANALYTICS: "performance_analytics",
  ABANDONED_CART_ANALYTICS: "abandoned_cart_analytics",
} as const;

// ============================================================================
// 11. Security & Fraud
// ============================================================================
export const SECURITY_FRAUD_FLAGS = {
  FRAUD_DETECTION_ENGINE: "fraud_detection_engine",
  IP_REPUTATION_CHECKS: "ip_reputation_checks",
  AUTOMATION_BOT_DETECTION: "automation_bot_detection",
  BLACKLISTS_MODULE: "blacklists_module",
} as const;

// ============================================================================
// 12. Webhooks & Extensibility
// ============================================================================
export const WEBHOOKS_EXTENSIBILITY_FLAGS = {
  OUTGOING_WEBHOOKS: "outgoing_webhooks",
  INCOMING_WEBHOOKS: "incoming_webhooks",
  WEBHOOK_RETRY_ENGINE: "webhook_retry_engine",
  WEBHOOK_TESTING_TOOLS: "webhook_testing_tools",
} as const;

// ============================================================================
// 13. System / Admin Tools
// ============================================================================
export const SYSTEM_ADMIN_FLAGS = {
  API_KEYS_SYSTEM: "api_keys_system",
  QUEUE_MANAGEMENT_DASHBOARD: "queue_management_dashboard",
  BACKUP_RESTORE_TOOLS: "backup_restore_tools",
  STORAGE_MANAGER: "storage_manager",
  REDIS_MANAGER: "redis_manager",
} as const;

// ============================================================================
// 14. SMS / Notifications
// ============================================================================
export const SMS_NOTIFICATIONS_FLAGS = {
  SMS_INTEGRATION: "sms_integration",
  SMS_TEMPLATES: "sms_templates",
  SMS_ABANDONED_CART: "sms_abandoned_cart",
  SYSTEM_NOTIFICATIONS: "system_notifications",
} as const;

// ============================================================================
// Combined Feature Flag Keys Object
// ============================================================================
export const FEATURE_FLAG_KEYS = {
  // Advanced Catalog
  ...ADVANCED_CATALOG_FLAGS,
  // Pricing & Discounts
  ...PRICING_DISCOUNTS_FLAGS,
  // Tax & GST Advanced
  ...TAX_GST_ADVANCED_FLAGS,
  // Payment Extensions
  ...PAYMENT_EXTENSIONS_FLAGS,
  // Checkout & Recovery
  ...CHECKOUT_RECOVERY_FLAGS,
  // Shipping & Fulfillment
  ...SHIPPING_FULFILLMENT_FLAGS,
  // Inventory & Returns
  ...INVENTORY_RETURNS_FLAGS,
  // Customer Growth
  ...CUSTOMER_GROWTH_FLAGS,
  // CMS & Theme
  ...CMS_THEME_FLAGS,
  // Analytics
  ...ANALYTICS_FLAGS,
  // Security & Fraud
  ...SECURITY_FRAUD_FLAGS,
  // Webhooks & Extensibility
  ...WEBHOOKS_EXTENSIBILITY_FLAGS,
  // System / Admin Tools
  ...SYSTEM_ADMIN_FLAGS,
  // SMS / Notifications
  ...SMS_NOTIFICATIONS_FLAGS,
} as const;

export type FeatureFlagKey =
  (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

/**
 * Feature flag descriptions
 */
export const FEATURE_FLAG_DESCRIPTIONS: Record<FeatureFlagKey, string> = {
  // Advanced Catalog
  [FEATURE_FLAG_KEYS.PRODUCT_BUNDLES]: "Enable product bundles functionality",
  [FEATURE_FLAG_KEYS.PRODUCT_CHOICE_SETS]:
    "Enable product choice sets for bundles",
  [FEATURE_FLAG_KEYS.PRODUCT_ASSOCIATIONS]:
    "Enable product associations (related products)",
  [FEATURE_FLAG_KEYS.PRODUCT_CROSS_SELL]:
    "Enable cross-sell product recommendations",
  [FEATURE_FLAG_KEYS.PRODUCT_UPSELL]: "Enable upsell product recommendations",
  [FEATURE_FLAG_KEYS.COLLECTIONS_MODULE]:
    "Enable collections module for product grouping",
  [FEATURE_FLAG_KEYS.ADVANCED_SEARCH_ENGINE]:
    "Enable advanced search engine (Meilisearch/Elasticsearch/OpenSearch)",
  [FEATURE_FLAG_KEYS.SEARCH_MEILISEARCH]:
    "Enable Meilisearch integration for search",
  [FEATURE_FLAG_KEYS.SEARCH_ELASTICSEARCH]:
    "Enable Elasticsearch integration for search",
  [FEATURE_FLAG_KEYS.SEARCH_OPENSEARCH]:
    "Enable OpenSearch integration for search",
  [FEATURE_FLAG_KEYS.PRODUCT_IMPORTS]: "Enable product import functionality",
  [FEATURE_FLAG_KEYS.PRODUCT_EXPORTS]: "Enable product export functionality",

  // Pricing & Discounts
  [FEATURE_FLAG_KEYS.ADVANCED_PRICING_ENGINE]:
    "Enable advanced pricing engine with price lists",
  [FEATURE_FLAG_KEYS.PRICE_LISTS]:
    "Enable price lists for different customer groups",
  [FEATURE_FLAG_KEYS.CUSTOMER_SPECIFIC_PRICING]:
    "Enable customer-specific pricing",
  [FEATURE_FLAG_KEYS.B2B_PRICING_MODE]:
    "Enable B2B pricing mode differentiation",
  [FEATURE_FLAG_KEYS.CURRENCY_SPECIFIC_PRICING]:
    "Enable currency-specific pricing overrides",
  [FEATURE_FLAG_KEYS.DISCOUNT_ENGINE_V2]:
    "Enable discount engine v2 with advanced features",
  [FEATURE_FLAG_KEYS.DISCOUNT_STACKING]: "Enable discount stacking rules",
  [FEATURE_FLAG_KEYS.DISCOUNT_PRIORITIES]: "Enable discount priority system",
  [FEATURE_FLAG_KEYS.CUSTOMER_GROUP_DISCOUNTS]:
    "Enable customer group-based discounts",

  // Tax & GST Advanced
  [FEATURE_FLAG_KEYS.GST_ENGINE_FULL_MODE]:
    "Enable full GST engine mode with advanced features",
  [FEATURE_FLAG_KEYS.HSN_CODE_ENFORCEMENT]:
    "Enable HSN code enforcement and validation",
  [FEATURE_FLAG_KEYS.TAX_RULE_OVERRIDES]:
    "Enable tax rule overrides at multiple levels",
  [FEATURE_FLAG_KEYS.MULTI_LEVEL_TAX_RULES]:
    "Enable multi-level tax rule system",
  [FEATURE_FLAG_KEYS.TAX_EXEMPTION_SYSTEM]:
    "Enable tax exemption system with certificate tracking",
  [FEATURE_FLAG_KEYS.TAX_AUDIT_LOGS]: "Enable comprehensive tax audit logs",

  // Payment Extensions
  [FEATURE_FLAG_KEYS.PAYMENT_METHOD_CHARGES]:
    "Enable payment method charges configuration",
  [FEATURE_FLAG_KEYS.WALLET_PAYMENTS]: "Enable wallet as payment method",
  [FEATURE_FLAG_KEYS.LOYALTY_POINTS_SYSTEM]: "Enable loyalty points system",
  [FEATURE_FLAG_KEYS.COD_RESTRICTIONS]: "Enable COD restrictions and rules",

  // Checkout & Recovery
  [FEATURE_FLAG_KEYS.ABANDONED_CART_RECOVERY]:
    "Enable abandoned cart recovery system",
  [FEATURE_FLAG_KEYS.ABANDONED_CART_EMAIL]:
    "Enable abandoned cart email recovery",
  [FEATURE_FLAG_KEYS.ABANDONED_CART_SMS]: "Enable abandoned cart SMS recovery",
  [FEATURE_FLAG_KEYS.ABANDONED_CHECKOUT_TRACKING]:
    "Enable abandoned checkout tracking",
  [FEATURE_FLAG_KEYS.MULTI_CURRENCY_CHECKOUT]:
    "Enable multi-currency checkout selection",

  // Shipping & Fulfillment
  [FEATURE_FLAG_KEYS.SHIPROCKET_INTEGRATION]:
    "Enable Shiprocket shipping integration",
  [FEATURE_FLAG_KEYS.NIMBUSPOST_INTEGRATION]:
    "Enable NimbusPost shipping integration",
  [FEATURE_FLAG_KEYS.PIN_CODE_SERVICEABILITY]:
    "Enable PIN code serviceability rules",
  [FEATURE_FLAG_KEYS.REAL_TIME_SHIPPING_RATES]:
    "Enable real-time shipping rate calculation",
  [FEATURE_FLAG_KEYS.LABEL_GENERATION]: "Enable shipping label generation",
  [FEATURE_FLAG_KEYS.ORDER_TRACKING]: "Enable order tracking functionality",

  // Inventory & Returns
  [FEATURE_FLAG_KEYS.LOW_STOCK_ALERTS]: "Enable low stock alerts",
  [FEATURE_FLAG_KEYS.INVENTORY_RESERVATIONS]:
    "Enable inventory reservations system",
  [FEATURE_FLAG_KEYS.BULK_INVENTORY_TOOLS]:
    "Enable bulk inventory management tools",
  [FEATURE_FLAG_KEYS.RETURN_MANAGEMENT]:
    "Enable return management (RMA) system",
  [FEATURE_FLAG_KEYS.RMA_GENERATION]: "Enable RMA generation for returns",

  // Customer Growth
  [FEATURE_FLAG_KEYS.CUSTOMER_GROUPS]: "Enable customer groups functionality",
  [FEATURE_FLAG_KEYS.CUSTOMER_SEGMENTATION]: "Enable customer segmentation",
  [FEATURE_FLAG_KEYS.LOYALTY_SYSTEM]: "Enable loyalty system",
  [FEATURE_FLAG_KEYS.WALLET_SYSTEM]: "Enable customer wallet system",

  // CMS & Theme
  [FEATURE_FLAG_KEYS.CMS_BUILDER]: "Enable CMS builder with content management",
  [FEATURE_FLAG_KEYS.CMS_BLOCKS]: "Enable CMS blocks (27+ block types)",
  [FEATURE_FLAG_KEYS.THEME_CUSTOMIZER]: "Enable theme customization features",
  [FEATURE_FLAG_KEYS.BLOG_MODULE]: "Enable blog module",

  // Analytics
  [FEATURE_FLAG_KEYS.ADVANCED_ANALYTICS_DASHBOARD]:
    "Enable advanced analytics dashboard",
  [FEATURE_FLAG_KEYS.SEARCH_ANALYTICS]: "Enable search analytics and metrics",
  [FEATURE_FLAG_KEYS.PERFORMANCE_ANALYTICS]: "Enable performance analytics",
  [FEATURE_FLAG_KEYS.ABANDONED_CART_ANALYTICS]:
    "Enable abandoned cart analytics",

  // Security & Fraud
  [FEATURE_FLAG_KEYS.FRAUD_DETECTION_ENGINE]: "Enable fraud detection engine",
  [FEATURE_FLAG_KEYS.IP_REPUTATION_CHECKS]: "Enable IP reputation checks",
  [FEATURE_FLAG_KEYS.AUTOMATION_BOT_DETECTION]:
    "Enable automation/bot detection",
  [FEATURE_FLAG_KEYS.BLACKLISTS_MODULE]: "Enable blacklists module",

  // Webhooks & Extensibility
  [FEATURE_FLAG_KEYS.OUTGOING_WEBHOOKS]: "Enable outgoing webhooks system",
  [FEATURE_FLAG_KEYS.INCOMING_WEBHOOKS]: "Enable incoming webhooks system",
  [FEATURE_FLAG_KEYS.WEBHOOK_RETRY_ENGINE]: "Enable webhook retry engine",
  [FEATURE_FLAG_KEYS.WEBHOOK_TESTING_TOOLS]: "Enable webhook testing tools",

  // System / Admin Tools
  [FEATURE_FLAG_KEYS.API_KEYS_SYSTEM]: "Enable API keys system",
  [FEATURE_FLAG_KEYS.QUEUE_MANAGEMENT_DASHBOARD]:
    "Enable queue management dashboard",
  [FEATURE_FLAG_KEYS.BACKUP_RESTORE_TOOLS]: "Enable backup and restore tools",
  [FEATURE_FLAG_KEYS.STORAGE_MANAGER]: "Enable storage manager",
  [FEATURE_FLAG_KEYS.REDIS_MANAGER]: "Enable Redis manager",

  // SMS / Notifications
  [FEATURE_FLAG_KEYS.SMS_INTEGRATION]: "Enable SMS integration",
  [FEATURE_FLAG_KEYS.SMS_TEMPLATES]: "Enable SMS templates",
  [FEATURE_FLAG_KEYS.SMS_ABANDONED_CART]: "Enable SMS abandoned cart recovery",
  [FEATURE_FLAG_KEYS.SYSTEM_NOTIFICATIONS]: "Enable system notifications",
};
