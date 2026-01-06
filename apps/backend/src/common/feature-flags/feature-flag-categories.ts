/**
 * Feature flag categories for organization
 * Used for grouping feature flags in admin UI
 */

import {
  ADVANCED_CATALOG_FLAGS,
  ANALYTICS_FLAGS,
  CHECKOUT_RECOVERY_FLAGS,
  CMS_THEME_FLAGS,
  CUSTOMER_GROWTH_FLAGS,
  INVENTORY_RETURNS_FLAGS,
  PAYMENT_EXTENSIONS_FLAGS,
  PRICING_DISCOUNTS_FLAGS,
  SECURITY_FRAUD_FLAGS,
  SHIPPING_FULFILLMENT_FLAGS,
  SMS_NOTIFICATIONS_FLAGS,
  SYSTEM_ADMIN_FLAGS,
  TAX_GST_ADVANCED_FLAGS,
  WEBHOOKS_EXTENSIBILITY_FLAGS,
} from "./feature-flag-keys";

export interface FeatureFlagCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  flags: readonly string[];
}

export const FEATURE_FLAG_CATEGORIES: FeatureFlagCategory[] = [
  {
    id: "advanced_catalog",
    name: "Advanced Catalog Features",
    description:
      "Product bundles, associations, collections, advanced search, imports/exports",
    icon: "Package",
    flags: Object.values(ADVANCED_CATALOG_FLAGS),
  },
  {
    id: "pricing_discounts",
    name: "Pricing & Discounts",
    description:
      "Advanced pricing engine, B2B pricing, currency-specific pricing, discount engine v2",
    icon: "DollarSign",
    flags: Object.values(PRICING_DISCOUNTS_FLAGS),
  },
  {
    id: "tax_gst_advanced",
    name: "Tax & GST Advanced",
    description:
      "GST engine full mode, HSN code enforcement, tax rule overrides, exemptions",
    icon: "Receipt",
    flags: Object.values(TAX_GST_ADVANCED_FLAGS),
  },
  {
    id: "payment_extensions",
    name: "Payment Extensions",
    description:
      "Payment method charges, wallet payments, loyalty points, COD restrictions",
    icon: "CreditCard",
    flags: Object.values(PAYMENT_EXTENSIONS_FLAGS),
  },
  {
    id: "checkout_recovery",
    name: "Checkout & Recovery",
    description:
      "Abandoned cart recovery, abandoned checkout tracking, multi-currency checkout",
    icon: "ShoppingCart",
    flags: Object.values(CHECKOUT_RECOVERY_FLAGS),
  },
  {
    id: "shipping_fulfillment",
    name: "Shipping & Fulfillment",
    description:
      "Shiprocket, NimbusPost, PIN code rules, real-time rates, label generation",
    icon: "Truck",
    flags: Object.values(SHIPPING_FULFILLMENT_FLAGS),
  },
  {
    id: "inventory_returns",
    name: "Inventory & Returns",
    description: "Low stock alerts, inventory reservations, bulk tools, RMA",
    icon: "Boxes",
    flags: Object.values(INVENTORY_RETURNS_FLAGS),
  },
  {
    id: "customer_growth",
    name: "Customer Growth & Segmentation",
    description: "Customer groups, segmentation, loyalty system, wallet system",
    icon: "Users",
    flags: Object.values(CUSTOMER_GROWTH_FLAGS),
  },
  {
    id: "cms_theme",
    name: "CMS & Theme",
    description: "CMS builder, theme customizer, blog module",
    icon: "Layout",
    flags: Object.values(CMS_THEME_FLAGS),
  },
  {
    id: "analytics",
    name: "Analytics",
    description:
      "Advanced analytics dashboard, search analytics, performance analytics",
    icon: "BarChart3",
    flags: Object.values(ANALYTICS_FLAGS),
  },
  {
    id: "security_fraud",
    name: "Security & Fraud",
    description:
      "Fraud detection engine, IP reputation checks, bot detection, blacklists",
    icon: "Shield",
    flags: Object.values(SECURITY_FRAUD_FLAGS),
  },
  {
    id: "webhooks_extensibility",
    name: "Webhooks & Extensibility",
    description:
      "Outgoing webhooks, incoming webhooks, retry engine, testing tools",
    icon: "Webhook",
    flags: Object.values(WEBHOOKS_EXTENSIBILITY_FLAGS),
  },
  {
    id: "system_admin",
    name: "System / Admin Tools",
    description:
      "API keys, queue management, backup/restore, storage manager, Redis manager",
    icon: "Settings",
    flags: Object.values(SYSTEM_ADMIN_FLAGS),
  },
  {
    id: "sms_notifications",
    name: "SMS / Notifications",
    description:
      "SMS integration, SMS templates, SMS abandoned cart, system notifications",
    icon: "Bell",
    flags: Object.values(SMS_NOTIFICATIONS_FLAGS),
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
