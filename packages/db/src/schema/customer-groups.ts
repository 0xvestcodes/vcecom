import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { priceLists } from "./price-lists";

/**
 * Tax display type enum
 * INCLUSIVE: Tax included in displayed price (B2C)
 * EXCLUSIVE: Tax shown separately (B2B)
 */
export const taxDisplayTypeEnum = pgEnum("tax_display_type", [
  "INCLUSIVE",
  "EXCLUSIVE",
]);

/**
 * Customer groups table
 * Stores customer group definitions (B2B, Wholesale, VIP, etc.)
 */
export const customerGroups = pgTable(
  "customer_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = inactive
    taxDisplayType: taxDisplayTypeEnum("tax_display_type")
      .notNull()
      .default("EXCLUSIVE"), // Tax display preference (INCLUSIVE for B2C, EXCLUSIVE for B2B)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("customer_groups_name_idx").on(table.name),
    activeIdx: index("customer_groups_active_idx").on(table.isActive),
  }),
);

/**
 * Customer group to price list mapping (many-to-many)
 * Links customer groups to price lists with priority
 */
export const customerGroupPriceLists = pgTable(
  "customer_group_price_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerGroupId: uuid("customer_group_id")
      .notNull()
      .references(() => customerGroups.id, { onDelete: "cascade" }),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(1), // Higher number = higher priority within group
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdIdx: index("customer_group_price_lists_group_id_idx").on(
      table.customerGroupId,
    ),
    priceListIdIdx: index("customer_group_price_lists_price_list_id_idx").on(
      table.priceListId,
    ),
    // Unique constraint: one price list per group (can be modified to allow multiple)
    uniqueGroupPriceList: index("customer_group_price_lists_unique_idx").on(
      table.customerGroupId,
      table.priceListId,
    ),
  }),
);

/**
 * Relations
 */
export const customerGroupsRelations = relations(
  customerGroups,
  ({ many }) => ({
    priceLists: many(customerGroupPriceLists),
    customers: many(customers),
  }),
);

export const customerGroupPriceListsRelations = relations(
  customerGroupPriceLists,
  ({ one }) => ({
    customerGroup: one(customerGroups, {
      fields: [customerGroupPriceLists.customerGroupId],
      references: [customerGroups.id],
    }),
    priceList: one(priceLists, {
      fields: [customerGroupPriceLists.priceListId],
      references: [priceLists.id],
    }),
  }),
);

export type CustomerGroup = typeof customerGroups.$inferSelect;
export type NewCustomerGroup = typeof customerGroups.$inferInsert;
export type CustomerGroupPriceList =
  typeof customerGroupPriceLists.$inferSelect;
export type NewCustomerGroupPriceList =
  typeof customerGroupPriceLists.$inferInsert;
