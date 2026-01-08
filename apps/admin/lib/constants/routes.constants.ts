/**
 * Route path constants
 * Centralizes all route paths and breadcrumb labels
 */

export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/",
  PRODUCTS: {
    LIST: "/products",
    CREATE: "/products/create",
    DETAIL: (id: string) => `/products/${id}`,
    CATEGORIES: {
      LIST: "/products/categories",
      CREATE: "/products/categories/create",
      DETAIL: (id: string) => `/products/categories/${id}`,
    },
    COLLECTIONS: {
      LIST: "/products/collections",
      CREATE: "/products/collections/create",
      DETAIL: (id: string) => `/products/collections/${id}`,
    },
    VARIANTS: {
      CREATE: (productId: string) => `/products/${productId}/variants/new`,
      DETAIL: (productId: string, variantId: string) =>
        `/products/${productId}/variants/${variantId}`,
    },
  },
  ORDERS: {
    LIST: "/orders",
    DETAIL: (id: string) => `/orders/${id}`,
    ABANDONED: {
      LIST: "/orders/abandoned",
      DETAIL: (cartId: string) => `/orders/abandoned/${cartId}`,
    },
  },
  CUSTOMERS: "/customers",
  DISCOUNTS: {
    LIST: "/discounts",
    CREATE: "/discounts/create",
    DETAIL: (id: string) => `/discounts/${id}`,
  },
  PRICE_LISTS: {
    LIST: "/price-lists",
    CREATE: "/price-lists/create",
    DETAIL: (id: string) => `/price-lists/${id}`,
  },
  BUNDLES: {
    LIST: "/bundles",
    CREATE: "/bundles/create",
    DETAIL: (id: string) => `/bundles/${id}`,
  },
  REVIEWS: "/reviews",
  STORAGE: "/storage",
  MEDIA_GROUPS: {
    LIST: "/media-groups",
    CREATE: "/media-groups/create",
    DETAIL: (id: string) => `/media-groups/${id}`,
  },
  SETTINGS: "/settings",
  PAYMENT_FEES: {
    LIST: "/settings/payment-fees",
    CREATE: "/settings/payment-fees/create",
    DETAIL: (id: string) => `/settings/payment-fees/${id}`,
  },
  CMS: {
    DASHBOARD: "/cms/dashboard",
    CONTENT_TYPES: {
      LIST: "/cms/content-types",
      CREATE: "/cms/content-types/create",
      ENTRIES: (contentTypeId: string) =>
        `/cms/content-types/${contentTypeId}/entries`,
      CREATE_ENTRY: (contentTypeId: string) =>
        `/cms/content-types/${contentTypeId}/entries/create`,
    },
    ENTRIES: {
      EDIT: (id: string) => `/cms/entries/${id}/edit`,
    },
    NAVIGATION: {
      LIST: "/cms/navigation",
      HEADER: "/cms/navigation/header",
      FOOTER: "/cms/navigation/footer",
    },
    MEDIA: "/cms/media",
    BLOCKS: {
      LIST: "/cms/blocks",
      CREATE: "/cms/blocks/create",
      EDIT: (id: string) => `/cms/blocks/${id}/edit`,
    },
    THEME: "/cms/theme",
    SEO: "/cms/seo",
    ROUTE_REGISTRY: "/cms/route-registry",
    PREVIEW: "/cms/preview",
    LOGS: "/cms/logs",
  },
} as const;

export const BREADCRUMB_LABELS = {
  HOME: "Home",
  DASHBOARD: "Dashboard",
  PRODUCTS: "Products",
  CREATE_PRODUCT: "Create Product",
  CATEGORIES: "Categories",
  CREATE_CATEGORY: "Create Category",
  COLLECTIONS: "Collections",
  CREATE_COLLECTION: "Create Collection",
  VARIANTS: "Variants",
  CREATE_VARIANT: "New Variant",
  INVENTORY: "Inventory",
  ORDERS: "Orders",
  ABANDONED_CHECKOUTS: "Abandoned Checkouts",
  CUSTOMERS: "Customers",
  DISCOUNTS: "Discounts",
  CREATE_DISCOUNT: "Create Discount",
  PRICE_LISTS: "Price Lists",
  CREATE_PRICE_LIST: "Create Price List",
  BUNDLES: "Bundles",
  CREATE_BUNDLE: "Create Bundle",
  REVIEWS: "Reviews",
  STORAGE: "Storage",
  MEDIA_GROUPS: "Media Groups",
  CREATE_MEDIA_GROUP: "Create Media Group",
  SETTINGS: "Settings",
} as const;
