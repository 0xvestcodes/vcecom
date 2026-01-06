import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { carts } from "./carts";
import { customers } from "./customers";

/**
 * Cart activity types
 */
export const cartActivityTypeEnum = pgEnum("cart_activity_type", [
  "item_added",
  "item_removed",
  "quantity_updated",
  "cart_viewed",
  "checkout_started",
  "discount_applied",
  "discount_removed",
]);

/**
 * Cart activities table
 * Tracks all cart events for abandoned cart detection and analytics
 */
export const cartActivities = pgTable(
  "cart_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id"),
    activityType: cartActivityTypeEnum("activity_type").notNull(),
    metadata: jsonb("metadata"), // Stores product info, quantities, etc.
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    cartIdIdx: index("cart_activities_cart_id_idx").on(table.cartId),
    customerIdIdx: index("cart_activities_customer_id_idx").on(
      table.customerId,
    ),
    sessionIdIdx: index("cart_activities_session_id_idx").on(table.sessionId),
    createdAtIdx: index("cart_activities_created_at_idx").on(table.createdAt),
    activityTypeIdx: index("cart_activities_activity_type_idx").on(
      table.activityType,
    ),
  }),
);

export const cartActivitiesRelations = relations(cartActivities, ({ one }) => ({
  cart: one(carts, {
    fields: [cartActivities.cartId],
    references: [carts.id],
  }),
  customer: one(customers, {
    fields: [cartActivities.customerId],
    references: [customers.id],
  }),
}));

export type CartActivity = typeof cartActivities.$inferSelect;
export type NewCartActivity = typeof cartActivities.$inferInsert;
