import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
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

export const regionPricingRuleTypeEnum = pgEnum("region_pricing_rule_type", [
  "OVERRIDE",
  "MARKUP",
]);

export const regionPricingOverrideTypeEnum = pgEnum(
  "region_pricing_override_type",
  ["FIXED", "PERCENTAGE"],
);

/**
 * Region pricing rules table
 * Stores state/region-based pricing rules
 */
export const regionPricingRules = pgTable(
  "region_pricing_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    type: regionPricingRuleTypeEnum("type").notNull(),
    countries: jsonb("countries").$type<string[]>(), // JSONB array of country codes (optional)
    states: jsonb("states").$type<string[]>(), // JSONB array of state codes/names
    productVariantId: uuid("product_variant_id").references(
      () => productVariants.id,
      { onDelete: "cascade" },
    ), // Optional variant-specific rule
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }), // Optional product-specific rule
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }), // Optional category-specific rule
    overrideType: regionPricingOverrideTypeEnum("override_type").notNull(), // FIXED or PERCENTAGE
    overrideValue: real("override_value").notNull(), // Price or percentage value
    priority: integer("priority").notNull().default(0), // Higher number = higher priority
    isActive: boolean("is_active").notNull().default(true),
    startDate: timestamp("start_date"), // Optional: Rule becomes active on this date
    endDate: timestamp("end_date"), // Optional: Rule expires on this date
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("region_pricing_rules_type_idx").on(table.type),
    variantIdIdx: index("region_pricing_rules_variant_id_idx").on(
      table.productVariantId,
    ),
    productIdIdx: index("region_pricing_rules_product_id_idx").on(
      table.productId,
    ),
    categoryIdIdx: index("region_pricing_rules_category_id_idx").on(
      table.categoryId,
    ),
    activeIdx: index("region_pricing_rules_active_idx").on(table.isActive),
    priorityIdx: index("region_pricing_rules_priority_idx").on(table.priority),
    startDateIdx: index("region_pricing_rules_start_date_idx").on(
      table.startDate,
    ),
    endDateIdx: index("region_pricing_rules_end_date_idx").on(table.endDate),
  }),
);

/**
 * Relations
 */
export const regionPricingRulesRelations = relations(
  regionPricingRules,
  ({ one }) => ({
    variant: one(productVariants, {
      fields: [regionPricingRules.productVariantId],
      references: [productVariants.id],
    }),
    product: one(products, {
      fields: [regionPricingRules.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [regionPricingRules.categoryId],
      references: [categories.id],
    }),
  }),
);

export type RegionPricingRule = typeof regionPricingRules.$inferSelect;
export type NewRegionPricingRule = typeof regionPricingRules.$inferInsert;
