import { relations } from "drizzle-orm";
import {
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
import { productVariants } from "./product-variants";
import { products } from "./products";

/**
 * Price list override type enum
 */
export const priceListOverrideTypeEnum = pgEnum("price_list_override_type", [
  "FIXED",
  "PERCENTAGE",
]);

/**
 * Price list type enum (B2C, B2B, Wholesale, etc.)
 */
export const priceListTypeEnum = pgEnum("price_list_type", [
  "B2C",
  "B2B",
  "WHOLESALE",
  "RETAIL",
  "CUSTOM",
]);

/**
 * Price lists table
 * Stores price list definitions (B2C, B2B, Wholesale, etc.)
 */
export const priceLists = pgTable(
  "price_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    type: priceListTypeEnum("type").notNull().default("CUSTOM"),
    priority: integer("priority").notNull().default(1), // Higher number = higher priority
    isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = inactive
    currency: text("currency"), // Currency code (nullable - null = applies to all currencies)
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("price_lists_name_idx").on(table.name),
    typeIdx: index("price_lists_type_idx").on(table.type),
    priorityIdx: index("price_lists_priority_idx").on(table.priority),
    activeIdx: index("price_lists_active_idx").on(table.isActive),
    currencyIdx: index("price_lists_currency_idx").on(table.currency),
  }),
);

/**
 * Price list items table
 * Stores individual price overrides (variant/product/category level)
 */
export const priceListItems = pgTable(
  "price_list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    productVariantId: uuid("product_variant_id").references(
      () => productVariants.id,
      { onDelete: "cascade" },
    ), // Variant-specific override (most specific)
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }), // Product-level override
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }), // Category-level override (least specific)
    currency: text("currency"), // Currency code (nullable - null = applies to all currencies for this price list)
    overrideType: priceListOverrideTypeEnum("override_type").notNull(), // FIXED or PERCENTAGE
    overrideValue: real("override_value").notNull(), // Amount or percentage
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    priceListIdIdx: index("price_list_items_price_list_id_idx").on(
      table.priceListId,
    ),
    variantIdIdx: index("price_list_items_variant_id_idx").on(
      table.productVariantId,
    ),
    productIdIdx: index("price_list_items_product_id_idx").on(table.productId),
    categoryIdIdx: index("price_list_items_category_id_idx").on(
      table.categoryId,
    ),
    currencyIdx: index("price_list_items_currency_idx").on(table.currency),
    // Ensure at least one of variant/product/category is set
    // This is enforced at application level, not DB level
  }),
);

/**
 * Relations
 */
export const priceListsRelations = relations(priceLists, ({ many }) => ({
  items: many(priceListItems),
}));

export const priceListItemsRelations = relations(priceListItems, ({ one }) => ({
  priceList: one(priceLists, {
    fields: [priceListItems.priceListId],
    references: [priceLists.id],
  }),
  variant: one(productVariants, {
    fields: [priceListItems.productVariantId],
    references: [productVariants.id],
  }),
  product: one(products, {
    fields: [priceListItems.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [priceListItems.categoryId],
    references: [categories.id],
  }),
}));

export type PriceList = typeof priceLists.$inferSelect;
export type NewPriceList = typeof priceLists.$inferInsert;
export type PriceListItem = typeof priceListItems.$inferSelect;
export type NewPriceListItem = typeof priceListItems.$inferInsert;
