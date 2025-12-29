/**
 * Centralized API endpoint constants
 * Type-safe endpoint references
 * Note: Backend uses API versioning with prefix "v" and default version "1"
 * All routes are prefixed with /v1/
 */

const API_VERSION_PREFIX = "/v1";

/**
 * Helper function to prefix endpoints with API version
 */
const v = (path: string): string => `${API_VERSION_PREFIX}${path}`;

export const endpoints = {
  auth: {
    login: v("/admin/auth/login"),
    me: v("/admin/auth/me"),
    refresh: v("/admin/auth/refresh"),
    logout: v("/admin/auth/logout"),
    sessions: v("/admin/auth/sessions"),
  },
  products: {
    list: v("/admin/products"),
    detail: (id: string) => v(`/admin/products/${id}`),
    create: v("/admin/products"),
    update: (id: string) => v(`/admin/products/${id}`),
    delete: (id: string) => v(`/admin/products/${id}`),
    collections: (id: string) => v(`/admin/products/${id}/collections`),
    images: {
      list: (id: string) => v(`/admin/products/${id}/images`),
      add: (id: string) => v(`/admin/products/${id}/images`),
      delete: (imageId: string) => v(`/admin/products/images/${imageId}`),
      updateOrder: (imageId: string) =>
        v(`/admin/products/images/${imageId}/order`),
      update: (imageId: string) => v(`/admin/products/images/${imageId}`),
      replace: (imageId: string) =>
        v(`/admin/products/images/${imageId}/replace`),
    },
    variantImages: {
      list: (productId: string, variantId: string) =>
        v(`/admin/products/${productId}/variants/${variantId}/images`),
    },
    variants: {
      list: (productId: string) => v(`/admin/products/${productId}/variants`),
      detail: (productId: string, variantId: string) =>
        v(`/admin/products/${productId}/variants/${variantId}`),
      create: (productId: string) =>
        v(`/admin/products/${productId}/variants`),
      update: (productId: string, variantId: string) =>
        v(`/admin/products/${productId}/variants/${variantId}`),
      delete: (productId: string, variantId: string) =>
        v(`/admin/products/${productId}/variants/${variantId}`),
    },
  },
  storage: {
    upload: v("/admin/storage/upload"),
    uploadBatch: v("/admin/storage/upload/batch"),
    list: v("/admin/storage/list"),
    get: (key: string) => v(`/admin/storage/${key}`),
    delete: (key: string) => v(`/admin/storage/${key}`),
    batchDelete: v("/admin/storage/batch"),
    presignedUrl: v("/admin/storage/presigned-url"),
  },
  inventory: {
    list: v("/admin/inventory"),
    detail: (variantId: string) => v(`/admin/inventory/${variantId}`),
    adjust: (variantId: string) => v(`/admin/inventory/${variantId}/adjust`),
    bulkAdjust: v("/admin/inventory/bulk-adjust"),
    logs: (variantId: string) => v(`/admin/inventory/${variantId}/logs`),
    reservations: (variantId: string) =>
      v(`/admin/inventory/${variantId}/reservations`),
    reservationsSummary: v("/admin/inventory/reservations/summary"),
    health: v("/admin/inventory/health"),
    settings: v("/admin/inventory/settings"),
    variantsIndex: v("/admin/inventory/variants/index"),
    metrics: v("/admin/inventory/metrics"),
  },
  admin: {
    stats: v("/admin/stats"),
  },
  orders: {
    list: v("/admin/orders"),
    detail: (id: string) => v(`/admin/orders/${id}`),
    timeline: (id: string) => v(`/admin/orders/${id}/timeline`),
    tracking: (id: string) => v(`/admin/orders/${id}/tracking`),
    reconcile: (paymentIntentId: string) =>
      v(`/admin/orders/reconcile/${paymentIntentId}`),
    markPaid: (id: string) => v(`/admin/orders/${id}/mark-paid`),
    refund: (id: string) => v(`/admin/orders/${id}/refund`),
    refunds: (id: string) => v(`/admin/orders/${id}/refunds`),
    notes: (id: string) => v(`/admin/orders/${id}/notes`),
    updateAddress: (id: string) => v(`/admin/orders/${id}/addresses`),
  },
  shipping: {
    shiprocketStatus: v("/admin/shipping/shiprocket/status"),
    shiprocketInitialize: v("/admin/shipping/shiprocket/initialize"),
    createShipment: v("/admin/shipping/shiprocket/shipments"),
    pickupLocations: v("/admin/shipping/shiprocket/pickup-locations"),
    courierServiceability: v("/admin/shipping/shiprocket/courier-serviceability"),
    trackShipment: (awb: string) => v(`/admin/shipping/shiprocket/tracking/${awb}`),
    cancelShipment: (awb: string) => v(`/admin/shipping/shiprocket/cancel/${awb}`),
    listShipments: v("/admin/shipping/shipments"),
    getShipment: (id: string) => v(`/admin/shipping/shipments/${id}`),
  },
  payments: {
    razorpay: {
      status: v("/admin/payments/razorpay/status"),
      initialize: v("/admin/payments/razorpay/initialize"),
      getPayment: (paymentId: string) =>
        v(`/admin/payments/razorpay/payments/${paymentId}`),
      getOrder: (orderId: string) => v(`/admin/payments/razorpay/orders/${orderId}`),
    },
  },
  invoices: {
    generate: (orderId: string) => v(`/admin/invoices/orders/${orderId}/generate`),
    get: (invoiceId: string) => v(`/admin/invoices/${invoiceId}`),
    getByOrder: (orderId: string) => v(`/admin/invoices/orders/${orderId}`),
    download: (invoiceId: string) => v(`/admin/invoices/${invoiceId}/download`),
  },
  paymentCharges: {
    list: v("/admin/payment-charges"),
    detail: (id: string) => v(`/admin/payment-charges/${id}`),
    create: v("/admin/payment-charges"),
    update: (id: string) => v(`/admin/payment-charges/${id}`),
    delete: (id: string) => v(`/admin/payment-charges/${id}`),
    preview: v("/admin/payment-charges/preview"),
  },
  abandonedCheckouts: {
    list: v("/admin/abandoned-checkouts"),
    detail: (cartId: string) => v(`/admin/abandoned-checkouts/${cartId}`),
  },
  customers: {
    list: v("/admin/customers"),
    detail: (id: string) => v(`/admin/customers/${id}`),
  },
  discounts: {
    list: v("/admin/discounts"),
    detail: (id: string) => v(`/admin/discounts/${id}`),
    create: v("/admin/discounts"),
    update: (id: string) => v(`/admin/discounts/${id}`),
    delete: (id: string) => v(`/admin/discounts/${id}`),
    driftReport: v("/admin/discounts/drift-report"),
    profile: v("/admin/discounts/profile"),
  },
  bundles: {
    list: v("/admin/bundles"),
    detail: (id: string) => v(`/admin/bundles/${id}`),
    create: v("/admin/bundles"),
    update: (id: string) => v(`/admin/bundles/${id}`),
    delete: (id: string) => v(`/admin/bundles/${id}`),
    sets: {
      create: (bundleId: string) => v(`/admin/bundles/${bundleId}/sets`),
      update: (bundleId: string, setId: string) =>
        v(`/admin/bundles/${bundleId}/sets/${setId}`),
      delete: (bundleId: string, setId: string) =>
        v(`/admin/bundles/${bundleId}/sets/${setId}`),
      items: {
        add: (bundleId: string, setId: string) =>
          v(`/admin/bundles/${bundleId}/sets/${setId}/items`),
        remove: (bundleId: string, setId: string, itemId: string) =>
          v(`/admin/bundles/${bundleId}/sets/${setId}/items/${itemId}`),
      },
    },
  },
  priceLists: {
    list: v("/admin/price-lists"),
    active: v("/admin/price-lists/active"),
    detail: (id: string) => v(`/admin/price-lists/${id}`),
    create: v("/admin/price-lists"),
    update: (id: string) => v(`/admin/price-lists/${id}`),
    delete: (id: string) => v(`/admin/price-lists/${id}`),
    addItem: (id: string) => v(`/admin/price-lists/${id}/items`),
    removeItem: (id: string, itemId: string) =>
      v(`/admin/price-lists/${id}/items/${itemId}`),
    driftReport: v("/admin/price-lists/drift-report"),
  },
  reviews: {
    list: v("/admin/reviews/search"),
    pending: v("/admin/reviews/pending"),
    search: v("/admin/reviews/search"),
    approve: (reviewId: string) => v(`/admin/reviews/${reviewId}/approve`),
    reject: (reviewId: string) => v(`/admin/reviews/${reviewId}/reject`),
    delete: (reviewId: string) => v(`/admin/reviews/${reviewId}`),
  },
  collections: {
    list: v("/admin/collections"),
    detail: (id: string) => v(`/admin/collections/${id}`),
    create: v("/admin/collections"),
    update: (id: string) => v(`/admin/collections/${id}`),
    delete: (id: string) => v(`/admin/collections/${id}`),
    preview: (id: string) => v(`/admin/collections/${id}/preview`),
    products: {
      list: (id: string) => v(`/admin/collections/${id}/products`),
      add: (id: string) => v(`/admin/collections/${id}/products`),
      remove: (id: string, productId: string) =>
        v(`/admin/collections/${id}/products/${productId}`),
    },
  },
  categories: {
    list: v("/admin/categories"),
    tree: v("/admin/categories/tree"),
    detail: (id: string) => v(`/admin/categories/${id}`),
    create: v("/admin/categories"),
    update: (id: string) => v(`/admin/categories/${id}`),
    delete: (id: string) => v(`/admin/categories/${id}`),
  },
  variantOptionTypes: {
    list: v("/admin/products/variant-option-types"),
    create: v("/admin/products/variant-option-types"),
    product: {
      list: (productId: string) =>
        v(`/admin/products/${productId}/variant-option-types`),
      create: (productId: string) =>
        v(`/admin/products/${productId}/variant-option-types`),
      delete: (productId: string, optionTypeId: string) =>
        v(`/admin/products/${productId}/variant-option-types/${optionTypeId}`),
      values: {
        create: (productId: string, optionTypeId: string) =>
          v(`/admin/products/${productId}/variant-option-types/${optionTypeId}/values`),
        delete: (productId: string, optionTypeId: string, valueId: string) =>
          v(`/admin/products/${productId}/variant-option-types/${optionTypeId}/values/${valueId}`),
      },
    },
  },
  activityLogs: {
    list: v("/admin/activity-logs"),
    detail: (id: string) => v(`/admin/activity-logs/${id}`),
  },
  customerGroups: {
    list: v("/admin/customer-groups"),
    active: v("/admin/customer-groups/active"),
    detail: (id: string) => v(`/admin/customer-groups/${id}`),
    create: v("/admin/customer-groups"),
    update: (id: string) => v(`/admin/customer-groups/${id}`),
    delete: (id: string) => v(`/admin/customer-groups/${id}`),
    assignPriceList: (id: string) =>
      v(`/admin/customer-groups/${id}/assign-price-list`),
    removePriceList: (id: string, priceListId: string) =>
      v(`/admin/customer-groups/${id}/price-lists/${priceListId}`),
    members: (id: string) => v(`/admin/customer-groups/${id}/members`),
  },
  mediaHealth: {
    scan: v("/admin/media/health/scan"),
    fix: (action: string) => v(`/admin/media/health/fix/${action}`),
    auditLogs: v("/admin/media/health/audit-logs"),
  },
  redis: {
    health: v("/admin/redis/health"),
    stats: v("/admin/redis/stats"),
    keys: v("/admin/redis/keys"),
  },
  jobs: {
    list: v("/admin/jobs"),
    history: (jobName: string) => v(`/admin/jobs/${jobName}/history`),
    trigger: (jobName: string) => v(`/admin/jobs/${jobName}/trigger`),
  },
  dashboards: {
    overview: v("/admin/dashboards/overview"),
    performance: v("/admin/dashboards/performance"),
    operations: v("/admin/dashboards/operations"),
    customerSupport: v("/admin/dashboards/customer-support"),
    productMerchandising: v("/admin/dashboards/product-merchandising"),
  },
  shippingMethods: {
    list: v("/admin/shipping-methods"),
    detail: (id: string) => v(`/admin/shipping-methods/${id}`),
    create: v("/admin/shipping-methods"),
    update: (id: string) => v(`/admin/shipping-methods/${id}`),
    delete: (id: string) => v(`/admin/shipping-methods/${id}`),
  },
} as const;
