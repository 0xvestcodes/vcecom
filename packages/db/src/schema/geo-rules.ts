import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const geoRuleTypeEnum = pgEnum("geo_rule_type", [
  "RESTRICTED",
  "ALLOWED",
]);

export const geoRuleActionEnum = pgEnum("geo_rule_action", [
  "BLOCK",
  "WARN",
  "REDIRECT",
]);

/**
 * Geo rules table
 * Stores region restrictions and allowed regions
 */
export const geoRules = pgTable(
  "geo_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    type: geoRuleTypeEnum("type").notNull(),
    countries: jsonb("countries").$type<string[]>(), // JSONB array of country codes (ISO 3166-1 alpha-2)
    states: jsonb("states").$type<string[]>(), // JSONB array of state codes/names
    action: geoRuleActionEnum("action").notNull().default("WARN"),
    redirectUrl: text("redirect_url"), // Optional redirect URL for REDIRECT action
    warningMessage: text("warning_message"), // Custom warning message
    isActive: boolean("is_active").notNull().default(true),
    priority: integer("priority").notNull().default(0), // Higher number = higher priority
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("geo_rules_type_idx").on(table.type),
    activeIdx: index("geo_rules_active_idx").on(table.isActive),
    priorityIdx: index("geo_rules_priority_idx").on(table.priority),
  }),
);

export type GeoRule = typeof geoRules.$inferSelect;
export type NewGeoRule = typeof geoRules.$inferInsert;
