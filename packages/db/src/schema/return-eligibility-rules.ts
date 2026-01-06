import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const returnEligibilityRules = pgTable(
  "return_eligibility_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(0), // Higher priority = evaluated first
    conditions: jsonb("conditions").notNull(), // JSONB for flexible rule conditions
    maxDaysAfterDelivery: integer("max_days_after_delivery"), // Max days after delivery to allow returns
    allowedReasons: jsonb("allowed_reasons"), // Array of allowed return reasons
    excludedCategories: jsonb("excluded_categories"), // Array of category IDs to exclude
    excludedProducts: jsonb("excluded_products"), // Array of product IDs to exclude
    minOrderValue: real("min_order_value"), // Minimum order value to be eligible
    maxReturnsPerCustomer: integer("max_returns_per_customer"), // Max returns per customer (time period in conditions)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    enabledIdx: index("return_eligibility_rules_enabled_idx").on(table.enabled),
    priorityIdx: index("return_eligibility_rules_priority_idx").on(
      table.priority,
    ),
  }),
);

export type ReturnEligibilityRule = typeof returnEligibilityRules.$inferSelect;
export type NewReturnEligibilityRule =
  typeof returnEligibilityRules.$inferInsert;
