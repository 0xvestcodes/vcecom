import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { collections } from "./collections";
import { products } from "./products";
import { tags } from "./tags";

/**
 * Discount type enum
 * - FIXED_AMOUNT: Fixed amount off (₹100 off)
 * - PERCENTAGE: Percentage off (10% off)
 * - BUY_X_GET_Y: Buy X get Y (BOGO)
 * - TIERED: Tiered pricing (Buy 3+, get 20% off)
 * - CART_LEVEL: Cart-level discounts (order > ₹1499 → 10% off)
 */
export const discountTypeEnum = pgEnum("discount_type", [
  "FIXED_AMOUNT",
  "PERCENTAGE",
  "BUY_X_GET_Y",
  "TIERED",
  "CART_LEVEL",
]);

/**
 * Discount application type enum
 * - AUTOMATIC: Applied automatically when conditions are met
 * - MANUAL: Requires manual code entry
 */
export const discountApplicationTypeEnum = pgEnum("discount_application_type", [
  "AUTOMATIC",
  "MANUAL",
]);

/**
 * Discount value type enum
 * - AMOUNT: Fixed amount discount (e.g., ₹100 off)
 * - PERCENTAGE: Percentage discount (e.g., 10% off)
 */
export const discountValueTypeEnum = pgEnum("discount_value_type", [
  "AMOUNT",
  "PERCENTAGE",
]);

/**
 * Discount scope enum
 * - ORDER: Discount applies to entire order
 * - PRODUCT: Discount applies to specific products
 */
export const discountScopeEnum = pgEnum("discount_scope", ["ORDER", "PRODUCT"]);

/**
 * Discount applies to enum
 * - SUBTOTAL: Discount applies to subtotal (before shipping)
 * - TOTAL: Discount applies to total (after shipping)
 */
export const discountAppliesToEnum = pgEnum("discount_applies_to", [
  "SUBTOTAL",
  "TOTAL",
]);

/**
 * Main discounts table
 */
export const discounts = pgTable(
  "discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    type: discountTypeEnum("type").notNull(), // STANDARD or BUY_GET
    applicationType: discountApplicationTypeEnum("application_type")
      .notNull()
      .default("MANUAL"), // AUTOMATIC or MANUAL

    // Discount value
    valueType: discountValueTypeEnum("value_type").notNull(), // AMOUNT or PERCENTAGE
    value: real("value").notNull(), // Amount in INR or percentage (0-100)
    minOrderAmount: real("min_order_amount"), // Minimum order amount to apply discount
    maxDiscountAmount: real("max_discount_amount"), // Maximum discount cap (for percentage discounts)

    // Enhanced constraints
    minQuantity: integer("min_quantity"), // Minimum quantity for tiered/cart-level discounts
    customerGroupIds: text("customer_group_ids"), // JSON array of customer group IDs

    // Scope
    scope: discountScopeEnum("scope").notNull().default("PRODUCT"), // ORDER or PRODUCT

    // Applies to (for cart-level discounts)
    appliesTo: discountAppliesToEnum("applies_to")
      .notNull()
      .default("SUBTOTAL"), // SUBTOTAL or TOTAL

    // Standard discount fields
    // For STANDARD type: applies to products/categories/collections/tags
    // For BUY_GET type: buy products/categories/collections/tags, get discount on order/product

    // Priority and stacking (like Shopify: lower = stronger)
    priority: integer("priority").notNull().default(1), // Lower number = higher priority
    canStack: boolean("can_stack").notNull().default(true), // Whether discount can stack with others
    mutuallyExclusive: boolean("mutually_exclusive").notNull().default(false), // Cannot combine with other discounts

    // Expiry and limits
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    isActive: boolean("is_active").notNull().default(true),
    usageLimit: integer("usage_limit"), // Total usage limit (null = unlimited)
    usageCount: integer("usage_count").notNull().default(0), // Current usage count
    perUserLimit: integer("per_user_limit"), // Limit per user (null = unlimited)

    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index("discounts_code_idx").on(table.code),
    typeIdx: index("discounts_type_idx").on(table.type),
    applicationTypeIdx: index("discounts_application_type_idx").on(
      table.applicationType,
    ),
    priorityIdx: index("discounts_priority_idx").on(table.priority),
    isActiveIdx: index("discounts_is_active_idx").on(table.isActive),
    startDateIdx: index("discounts_start_date_idx").on(table.startDate),
    endDateIdx: index("discounts_end_date_idx").on(table.endDate),
    minOrderAmountIdx: index("discounts_min_order_amount_idx").on(
      table.minOrderAmount,
    ),
    minQuantityIdx: index("discounts_min_quantity_idx").on(table.minQuantity),
  }),
);

/**
 * Discount to Products (many-to-many)
 * For STANDARD: products that discount applies to
 * For BUY_GET: products to buy
 */
export const discountProducts = pgTable(
  "discount_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_products_discount_id_idx").on(
      table.discountId,
    ),
    productIdIdx: index("discount_products_product_id_idx").on(table.productId),
    uniqueDiscountProduct: index("discount_products_unique_idx").on(
      table.discountId,
      table.productId,
    ),
  }),
);

/**
 * Discount to Categories (many-to-many)
 * For STANDARD: categories that discount applies to
 * For BUY_GET: categories to buy from
 */
export const discountCategories = pgTable(
  "discount_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_categories_discount_id_idx").on(
      table.discountId,
    ),
    categoryIdIdx: index("discount_categories_category_id_idx").on(
      table.categoryId,
    ),
    uniqueDiscountCategory: index("discount_categories_unique_idx").on(
      table.discountId,
      table.categoryId,
    ),
  }),
);

/**
 * Discount to Collections (many-to-many)
 * For STANDARD: collections that discount applies to
 * For BUY_GET: collections to buy from
 */
export const discountCollections = pgTable(
  "discount_collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_collections_discount_id_idx").on(
      table.discountId,
    ),
    collectionIdIdx: index("discount_collections_collection_id_idx").on(
      table.collectionId,
    ),
    uniqueDiscountCollection: index("discount_collections_unique_idx").on(
      table.discountId,
      table.collectionId,
    ),
  }),
);

/**
 * Discount to Tags (many-to-many)
 * For STANDARD: tags that discount applies to
 * For BUY_GET: tags to buy from
 */
export const discountTags = pgTable(
  "discount_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_tags_discount_id_idx").on(table.discountId),
    tagIdIdx: index("discount_tags_tag_id_idx").on(table.tagId),
    uniqueDiscountTag: index("discount_tags_unique_idx").on(
      table.discountId,
      table.tagId,
    ),
  }),
);

/**
 * Buy Get specific: Products to get (for BUY_GET type)
 * When buying certain products, get discount on these products
 */
export const discountGetProducts = pgTable(
  "discount_get_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_get_products_discount_id_idx").on(
      table.discountId,
    ),
    productIdIdx: index("discount_get_products_product_id_idx").on(
      table.productId,
    ),
  }),
);

/**
 * Buy Get specific: Categories to get discount on
 */
export const discountGetCategories = pgTable(
  "discount_get_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_get_categories_discount_id_idx").on(
      table.discountId,
    ),
    categoryIdIdx: index("discount_get_categories_category_id_idx").on(
      table.categoryId,
    ),
  }),
);

/**
 * Buy Get specific: Collections to get discount on
 */
export const discountGetCollections = pgTable(
  "discount_get_collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_get_collections_discount_id_idx").on(
      table.discountId,
    ),
    collectionIdIdx: index("discount_get_collections_collection_id_idx").on(
      table.collectionId,
    ),
  }),
);

/**
 * Buy Get specific: Tags to get discount on
 */
export const discountGetTags = pgTable(
  "discount_get_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_get_tags_discount_id_idx").on(
      table.discountId,
    ),
    tagIdIdx: index("discount_get_tags_tag_id_idx").on(table.tagId),
  }),
);

/**
 * Tiered discount rules (for TIERED type)
 * Multiple quantity thresholds with different discount values
 */
export const discountTieredRules = pgTable(
  "discount_tiered_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    minQuantity: integer("min_quantity").notNull(), // Minimum quantity for this tier
    value: real("value").notNull(), // Discount value for this tier
    valueType: discountValueTypeEnum("value_type").notNull(), // AMOUNT or PERCENTAGE
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_tiered_rules_discount_id_idx").on(
      table.discountId,
    ),
    minQuantityIdx: index("discount_tiered_rules_min_quantity_idx").on(
      table.minQuantity,
    ),
    uniqueTier: index("discount_tiered_rules_unique_idx").on(
      table.discountId,
      table.minQuantity,
    ),
  }),
);

/**
 * Discount exclusion rules (mutually exclusive discounts)
 */
export const discountExclusions = pgTable(
  "discount_exclusions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    excludedDiscountId: uuid("excluded_discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_exclusions_discount_id_idx").on(
      table.discountId,
    ),
    excludedDiscountIdIdx: index(
      "discount_exclusions_excluded_discount_id_idx",
    ).on(table.excludedDiscountId),
    uniqueExclusion: index("discount_exclusions_unique_idx").on(
      table.discountId,
      table.excludedDiscountId,
    ),
  }),
);

/**
 * Discount usage tracking (for usage limits)
 */
export const discountUsages = pgTable(
  "discount_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id"), // null for guest users
    orderId: uuid("order_id"), // Track which order used the discount
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (table) => ({
    discountIdIdx: index("discount_usages_discount_id_idx").on(
      table.discountId,
    ),
    userIdIdx: index("discount_usages_user_id_idx").on(table.userId),
    orderIdIdx: index("discount_usages_order_id_idx").on(table.orderId),
  }),
);

/**
 * Relations
 */
export const discountsRelations = relations(discounts, ({ many }) => ({
  products: many(discountProducts),
  categories: many(discountCategories),
  collections: many(discountCollections),
  tags: many(discountTags),
  getProducts: many(discountGetProducts),
  getCategories: many(discountGetCategories),
  getCollections: many(discountGetCollections),
  getTags: many(discountGetTags),
  tieredRules: many(discountTieredRules),
  exclusions: many(discountExclusions),
  usages: many(discountUsages),
}));

export const discountProductsRelations = relations(
  discountProducts,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountProducts.discountId],
      references: [discounts.id],
    }),
    product: one(products, {
      fields: [discountProducts.productId],
      references: [products.id],
    }),
  }),
);

export const discountCategoriesRelations = relations(
  discountCategories,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountCategories.discountId],
      references: [discounts.id],
    }),
    category: one(categories, {
      fields: [discountCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const discountCollectionsRelations = relations(
  discountCollections,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountCollections.discountId],
      references: [discounts.id],
    }),
    collection: one(collections, {
      fields: [discountCollections.collectionId],
      references: [collections.id],
    }),
  }),
);

export const discountTagsRelations = relations(discountTags, ({ one }) => ({
  discount: one(discounts, {
    fields: [discountTags.discountId],
    references: [discounts.id],
  }),
  tag: one(tags, {
    fields: [discountTags.tagId],
    references: [tags.id],
  }),
}));

export const discountGetProductsRelations = relations(
  discountGetProducts,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountGetProducts.discountId],
      references: [discounts.id],
    }),
    product: one(products, {
      fields: [discountGetProducts.productId],
      references: [products.id],
    }),
  }),
);

export const discountGetCategoriesRelations = relations(
  discountGetCategories,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountGetCategories.discountId],
      references: [discounts.id],
    }),
    category: one(categories, {
      fields: [discountGetCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const discountGetCollectionsRelations = relations(
  discountGetCollections,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountGetCollections.discountId],
      references: [discounts.id],
    }),
    collection: one(collections, {
      fields: [discountGetCollections.collectionId],
      references: [collections.id],
    }),
  }),
);

export const discountGetTagsRelations = relations(
  discountGetTags,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountGetTags.discountId],
      references: [discounts.id],
    }),
    tag: one(tags, {
      fields: [discountGetTags.tagId],
      references: [tags.id],
    }),
  }),
);

export const discountTieredRulesRelations = relations(
  discountTieredRules,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountTieredRules.discountId],
      references: [discounts.id],
    }),
  }),
);

export const discountExclusionsRelations = relations(
  discountExclusions,
  ({ one }) => ({
    discount: one(discounts, {
      fields: [discountExclusions.discountId],
      references: [discounts.id],
    }),
    excludedDiscount: one(discounts, {
      fields: [discountExclusions.excludedDiscountId],
      references: [discounts.id],
    }),
  }),
);

export const discountUsagesRelations = relations(discountUsages, ({ one }) => ({
  discount: one(discounts, {
    fields: [discountUsages.discountId],
    references: [discounts.id],
  }),
}));
