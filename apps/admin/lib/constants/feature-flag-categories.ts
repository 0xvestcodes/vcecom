/**
 * Feature flag categories for frontend UI organization
 * Mirrors backend category structure
 */

export interface FeatureFlagCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  flags: string[];
}

export const FEATURE_FLAG_CATEGORIES: FeatureFlagCategory[] = [
  {
    id: "advanced_catalog",
    name: "Advanced Catalog Features",
    description:
      "Product bundles, associations, collections, advanced search, imports/exports",
    icon: "Package",
    flags: [
      "product_bundles",
      "product_choice_sets",
      "product_associations",
      "product_cross_sell",
      "product_upsell",
      "collections_module",
      "advanced_search_engine",
      "search_meilisearch",
      "search_elasticsearch",
      "search_opensearch",
      "product_imports",
      "product_exports",
    ],
  },
  {
    id: "pricing_discounts",
    name: "Pricing & Discounts",
    description:
      "Advanced pricing engine, B2B pricing, currency-specific pricing, discount engine v2",
    icon: "DollarSign",
    flags: [
      "advanced_pricing_engine",
      "price_lists",
      "customer_specific_pricing",
      "b2b_pricing_mode",
      "currency_specific_pricing",
      "discount_engine_v2",
      "discount_stacking",
      "discount_priorities",
      "customer_group_discounts",
    ],
  },
  {
    id: "tax_gst_advanced",
    name: "Tax & GST Advanced",
    description:
      "GST engine full mode, HSN code enforcement, tax rule overrides, exemptions",
    icon: "Receipt",
    flags: [
      "gst_engine_full_mode",
      "hsn_code_enforcement",
      "tax_rule_overrides",
      "multi_level_tax_rules",
      "tax_exemption_system",
      "tax_audit_logs",
    ],
  },
  {
    id: "payment_extensions",
    name: "Payment Extensions",
    description:
      "Payment method charges, wallet payments, loyalty points, COD restrictions",
    icon: "CreditCard",
    flags: [
      "payment_method_charges",
      "wallet_payments",
      "loyalty_points_system",
      "cod_restrictions",
    ],
  },
  {
    id: "checkout_recovery",
    name: "Checkout & Recovery",
    description:
      "Abandoned cart recovery, abandoned checkout tracking, multi-currency checkout",
    icon: "ShoppingCart",
    flags: [
      "abandoned_cart_recovery",
      "abandoned_cart_email",
      "abandoned_cart_sms",
      "abandoned_checkout_tracking",
      "multi_currency_checkout",
    ],
  },
  {
    id: "shipping_fulfillment",
    name: "Shipping & Fulfillment",
    description:
      "Shiprocket, NimbusPost, PIN code rules, real-time rates, label generation",
    icon: "Truck",
    flags: [
      "shiprocket_integration",
      "nimbuspost_integration",
      "pin_code_serviceability",
      "real_time_shipping_rates",
      "label_generation",
      "order_tracking",
    ],
  },
  {
    id: "inventory_returns",
    name: "Inventory & Returns",
    description: "Low stock alerts, inventory reservations, bulk tools, RMA",
    icon: "Boxes",
    flags: [
      "low_stock_alerts",
      "inventory_reservations",
      "bulk_inventory_tools",
      "return_management",
      "rma_generation",
    ],
  },
  {
    id: "customer_growth",
    name: "Customer Growth & Segmentation",
    description: "Customer groups, segmentation, loyalty system, wallet system",
    icon: "Users",
    flags: [
      "customer_groups",
      "customer_segmentation",
      "loyalty_system",
      "wallet_system",
    ],
  },
  {
    id: "cms_theme",
    name: "CMS & Theme",
    description: "CMS builder, theme customizer, blog module",
    icon: "Layout",
    flags: ["cms_builder", "cms_blocks", "theme_customizer", "blog_module"],
  },
  {
    id: "analytics",
    name: "Analytics",
    description:
      "Advanced analytics dashboard, search analytics, performance analytics",
    icon: "BarChart3",
    flags: [
      "advanced_analytics_dashboard",
      "search_analytics",
      "performance_analytics",
      "abandoned_cart_analytics",
    ],
  },
  {
    id: "security_fraud",
    name: "Security & Fraud",
    description:
      "Fraud detection engine, IP reputation checks, bot detection, blacklists",
    icon: "Shield",
    flags: [
      "fraud_detection_engine",
      "ip_reputation_checks",
      "automation_bot_detection",
      "blacklists_module",
    ],
  },
  {
    id: "webhooks_extensibility",
    name: "Webhooks & Extensibility",
    description:
      "Outgoing webhooks, incoming webhooks, retry engine, testing tools",
    icon: "Webhook",
    flags: [
      "outgoing_webhooks",
      "incoming_webhooks",
      "webhook_retry_engine",
      "webhook_testing_tools",
    ],
  },
  {
    id: "system_admin",
    name: "System / Admin Tools",
    description:
      "API keys, queue management, backup/restore, storage manager, Redis manager",
    icon: "Settings",
    flags: [
      "api_keys_system",
      "queue_management_dashboard",
      "backup_restore_tools",
      "storage_manager",
      "redis_manager",
    ],
  },
  {
    id: "sms_notifications",
    name: "SMS / Notifications",
    description:
      "SMS integration, SMS templates, SMS abandoned cart, system notifications",
    icon: "Bell",
    flags: [
      "sms_integration",
      "sms_templates",
      "sms_abandoned_cart",
      "system_notifications",
    ],
  },
];

/**
 * Get category by ID
 */
export function getCategoryById(id: string): FeatureFlagCategory | undefined {
  return FEATURE_FLAG_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Get category for a feature flag key
 */
export function getCategoryForFlag(
  flagKey: string,
): FeatureFlagCategory | undefined {
  return FEATURE_FLAG_CATEGORIES.find((cat) => cat.flags.includes(flagKey));
}

/**
 * Get all flag keys grouped by category
 */
export function getFlagsByCategory(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const category of FEATURE_FLAG_CATEGORIES) {
    result[category.id] = [...category.flags];
  }
  return result;
}
