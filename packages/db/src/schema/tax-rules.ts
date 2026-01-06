import { relations } from "drizzle-orm";
import {
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

/**
 * Tax rule types - defines the level at which tax rule applies
 */
export const taxRuleTypeEnum = pgEnum("tax_rule_type", [
  "CUSTOMER_GROUP",
  "CUSTOMER",
  "CATEGORY",
  "PRODUCT",
  "VARIANT",
]);

/**
 * Tax rules table
 * Stores tax rate overrides at different levels (customer group, customer, category, product, variant)
 * Priority: Lower number = higher priority (like discounts)
 */
export const taxRules = pgTable(
  "tax_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    ruleType: taxRuleTypeEnum("rule_type").notNull(),
    entityId: uuid("entity_id").notNull(), // ID of the entity (customer_group_id, customer_id, category_id, product_id, variant_id)
    gstRate: real("gst_rate").notNull(), // GST rate percentage (e.g., 18 for 18%)
    priority: integer("priority").notNull().default(1), // Lower number = higher priority
    isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = inactive
    startDate: timestamp("start_date"), // Optional: Rule becomes active on this date
    endDate: timestamp("end_date"), // Optional: Rule expires on this date
    metadata: jsonb("metadata"), // JSON object for flexible metadata storage
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ruleTypeIdx: index("tax_rules_rule_type_idx").on(table.ruleType),
    entityIdIdx: index("tax_rules_entity_id_idx").on(table.entityId),
    priorityIdx: index("tax_rules_priority_idx").on(table.priority),
    activeIdx: index("tax_rules_active_idx").on(table.isActive),
    startDateIdx: index("tax_rules_start_date_idx").on(table.startDate),
    endDateIdx: index("tax_rules_end_date_idx").on(table.endDate),
    // Composite index for efficient rule resolution queries
    ruleTypeEntityIdx: index("tax_rules_rule_type_entity_idx").on(
      table.ruleType,
      table.entityId,
    ),
  }),
);

export const taxRulesRelations = relations(taxRules, () => ({}));

export type TaxRule = typeof taxRules.$inferSelect;
export type NewTaxRule = typeof taxRules.$inferInsert;
