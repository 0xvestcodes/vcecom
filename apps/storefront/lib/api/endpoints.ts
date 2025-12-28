/**
 * API endpoint mappings for storefront
 * All endpoints are prefixed with /store
 */

export const endpoints = {
  products: {
    list: "/store/products",
    detail: (id: string) => `/store/products/${id}`,
    variants: (id: string) => `/store/products/${id}/variants`,
    variantInventory: (variantId: string) =>
      `/store/products/variants/${variantId}/inventory`,
    reviews: (id: string) => `/store/products/${id}/reviews`,
    reviewAggregate: (variantId: string) =>
      `/store/products/${variantId}/reviews/aggregate`,
    createReview: (variantId: string) => `/store/products/${variantId}/reviews`,
    reviewDetail: (reviewId: string) => `/store/products/reviews/${reviewId}`,
    updateReview: (reviewId: string) => `/store/products/reviews/${reviewId}`,
    deleteReview: (reviewId: string) => `/store/products/reviews/${reviewId}`,
    markReviewHelpful: (reviewId: string) =>
      `/store/products/reviews/${reviewId}/helpful`,
    removeReviewHelpful: (reviewId: string) =>
      `/store/products/reviews/${reviewId}/helpful`,
    recommendations: (id: string) => `/store/products/${id}/recommendations`,
    search: "/store/products/search",
    filter: "/store/products/filter",
  },
  categories: {
    list: "/store/categories",
    tree: "/store/categories/tree",
    detail: (id: string) => `/store/categories/${id}`,
    bySlug: (slug: string) => `/store/categories/slug/${slug}`,
    products: (id: string) => `/store/categories/${id}/products`,
  },
  collections: {
    list: "/store/collections",
    detail: (id: string) => `/store/collections/${id}`,
    products: (id: string) => `/store/collections/${id}/products`,
  },
  cart: {
    get: "/store/cart",
    create: "/store/cart",
    addItem: "/store/cart/items",
    updateItem: (id: string) => `/store/cart/items/${id}`,
    removeItem: (id: string) => `/store/cart/items/${id}`,
    clear: "/store/cart",
    reset: "/store/cart/reset",
    applyCoupon: "/store/cart/coupon",
    removeCoupon: "/store/cart/coupon",
    heartbeat: "/store/cart/heartbeat",
  },
  checkout: {
    start: "/store/checkout/start",
    address: "/store/checkout/address",
    shippingMethods: "/store/checkout/shipping-methods",
    shipping: "/store/checkout/shipping",
    paymentMethods: "/store/checkout/payment-methods",
    payment: "/store/checkout/payment",
    confirm: "/store/checkout/confirm",
  },
  auth: {
    register: "/store/auth/register",
    login: "/store/auth/login",
    logout: "/store/auth/logout",
    refresh: "/store/auth/refresh",
    me: "/store/auth/me",
  },
  customers: {
    register: "/store/customers/register",
    me: "/store/customers/me",
    updateProfile: "/store/customers/me",
    changePassword: "/store/customers/change-password",
    claimAccount: "/store/customers/claim",
    orders: "/store/customers/orders",
    addresses: "/store/customers/addresses",
  },
  addresses: {
    list: "/store/customers/addresses",
    create: "/store/customers/addresses",
    detail: (id: string) => `/store/customers/addresses/${id}`,
    update: (id: string) => `/store/customers/addresses/${id}`,
    delete: (id: string) => `/store/customers/addresses/${id}`,
    setDefault: (id: string) => `/store/customers/addresses/${id}/set-default`,
  },
  orders: {
    create: "/store/orders",
    list: "/store/orders",
    detail: (id: string) => `/store/orders/${id}`,
    updateStatus: (id: string) => `/store/orders/${id}/status`,
    tracking: (id: string) => `/store/orders/${id}/tracking`,
    timeline: (id: string) => `/store/orders/${id}/timeline`,
    retryPayment: (id: string) => `/store/orders/${id}/payment-retry`,
    cancel: (id: string) => `/store/orders/${id}/cancel`,
  },
  bundles: {
    list: "/store/bundles",
    detail: (id: string) => `/store/bundles/${id}`,
  },
  discounts: {
    validate: "/store/discounts/validate",
  },
  payments: {
    createRazorpayOrder: "/store/payments/razorpay/orders",
    verifyPayment: "/store/payments/razorpay/verify",
  },
  addressAutocomplete: {
    states: "/store/address-autocomplete/states",
    allStates: "/store/address-autocomplete/states/all",
    districts: "/store/address-autocomplete/districts",
    districtsByState: "/store/address-autocomplete/districts/by-state",
  },
  search: {
    global: "/store/search",
  },
  config: {
    store: "/store/config",
  },
} as const;
