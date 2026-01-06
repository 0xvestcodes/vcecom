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
import { customerGroups } from "./customer-groups";

/**
 * Loyalty rule type enum
 */
export const loyaltyRuleTypeEnum = pgEnum("loyalty_rule_type", [
  "earning", // Rule for earning points/credits
  "redemption", // Rule for redeeming points/credits
]);

/**
 * Loyalty rule calculation type enum
 */
export const loyaltyRuleCalculationTypeEnum = pgEnum(
  "loyalty_rule_calculation_type",
  ["percentage", "fixed", "tiered"],
);

/**
 * Loyalty rules table
 * Configurable rules for earning and redeeming loyalty points and wallet credits
 */
export const loyaltyRules = pgTable(
  "loyalty_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    type: loyaltyRuleTypeEnum("type").notNull(),
    ruleType: loyaltyRuleCalculationTypeEnum("rule_type").notNull(),
    // For earning rules
    pointsPerRupee: real("points_per_rupee").notNull().default(0), // e.g., 1 point per ₹100 = 0.01
    // For redemption rules
    rupeesPerPoint: real("rupees_per_point").notNull().default(0), // e.g., ₹1 per 100 points = 0.01
    minOrderValue: real("min_order_value").notNull().default(0), // Minimum order value to earn
    minPointsToRedeem: integer("min_points_to_redeem").notNull().default(0), // Minimum points required to redeem
    maxPointsPerOrder: integer("max_points_per_order"), // Max points redeemable per order (null = unlimited)
    isActive: boolean("is_active").notNull().default(true),
    validFrom: timestamp("valid_from").notNull().defaultNow(),
    validUntil: timestamp("valid_until"), // null = no expiry
    customerGroupId: uuid("customer_group_id").references(
      () => customerGroups.id,
      {
        onDelete: "set null",
      },
    ), // Group-specific rules (null = applies to all)
    metadata: jsonb("metadata").$type<{
      tierThresholds?: Array<{ min: number; pointsPerRupee: number }>;
      maxRedemptionPercentage?: number; // Max % of order that can be paid with points
      [key: string]: unknown;
    }>(), // Additional rule configuration
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("loyalty_rules_type_idx").on(table.type),
    isActiveIdx: index("loyalty_rules_is_active_idx").on(table.isActive),
    customerGroupIdIdx: index("loyalty_rules_customer_group_id_idx").on(
      table.customerGroupId,
    ),
    validFromIdx: index("loyalty_rules_valid_from_idx").on(table.validFrom),
    validUntilIdx: index("loyalty_rules_valid_until_idx").on(table.validUntil),
  }),
);

export const loyaltyRulesRelations = relations(loyaltyRules, ({ one }) => ({
  customerGroup: one(customerGroups, {
    fields: [loyaltyRules.customerGroupId],
    references: [customerGroups.id],
  }),
}));

export type LoyaltyRule = typeof loyaltyRules.$inferSelect;
export type NewLoyaltyRule = typeof loyaltyRules.$inferInsert;
