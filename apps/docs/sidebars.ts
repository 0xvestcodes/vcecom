import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "introduction",
    {
      type: "category",
      label: "System Architecture",
      items: [
        "architecture/overview",
        "architecture/monorepo",
        "architecture/modules",
        "architecture/dependencies",
      ],
    },
    {
      type: "category",
      label: "Authentication",
      items: ["authentication/admin-auth", "authentication/storefront-auth"],
    },
    {
      type: "category",
      label: "Product Catalog",
      items: [
        "catalog/products",
        "catalog/variants",
        "catalog/collections",
        "catalog/inventory",
      ],
    },
    {
      type: "category",
      label: "Pricing System",
      items: [
        "pricing/overview",
        "pricing/price-lists",
        "pricing/customer-groups",
        "pricing/pricing-engine",
        "pricing/snapshots",
        "pricing/drift-detection",
      ],
    },
    {
      type: "category",
      label: "Discount Engine",
      items: [
        "discounts/overview",
        "discounts/definitions",
        "discounts/engine",
        "discounts/priority-stacking",
        "discounts/snapshots",
        "discounts/drift-detection",
      ],
    },
    {
      type: "category",
      label: "Bundles Engine",
      items: [
        "bundles/overview",
        "bundles/definition",
        "bundles/choice-sets",
        "bundles/pricing",
        "bundles/cart-integration",
      ],
    },
    {
      type: "category",
      label: "Checkout System",
      items: [
        "checkout/overview",
        "checkout/guest-checkout",
        "checkout/state-machine",
        "checkout/payment-intent",
        "checkout/webhooks",
        "checkout/inventory-flow",
      ],
    },
    {
      type: "category",
      label: "Orders System",
      items: [
        "orders/overview",
        "orders/creation",
        "orders/fulfillment",
        "orders/refunds",
        "orders/reconciliation",
        "orders/inventory-reconciliation",
      ],
    },
    {
      type: "category",
      label: "Reviews System",
      items: [
        "reviews/overview",
        "reviews/verified-purchase",
        "reviews/moderation",
        "reviews/aggregation",
        "reviews/caching",
      ],
    },
    {
      type: "category",
      label: "Observability",
      items: [
        "observability/logging",
        "observability/tracing",
        "observability/context",
        "observability/correlation",
      ],
    },
    {
      type: "category",
      label: "Redis Architecture",
      items: [
        "redis/overview",
        "redis/key-patterns",
        "redis/caching-layers",
        "redis/expirations",
      ],
    },
    {
      type: "category",
      label: "Admin Panel",
      items: ["admin/pagination"],
    },
    {
      type: "category",
      label: "API Reference",
      items: [
        "api-reference/admin-api",
        "api-reference/store-api",
        {
          type: "link",
          label: "Store API (Interactive)",
          href: "/api-reference/store",
        },
        {
          type: "link",
          label: "Admin API (Interactive)",
          href: "/api-reference/admin",
        },
      ],
    },
    {
      type: "category",
      label: "Database Schema",
      items: [
        "database-schema/overview",
        "database-schema/erd",
        "database-schema/tables",
      ],
    },
    {
      type: "category",
      label: "Deployment",
      items: [
        "deployment/overview",
        "deployment/docker",
        "deployment/scaling",
        "deployment/production",
      ],
    },
  ],
};

export default sidebars;
