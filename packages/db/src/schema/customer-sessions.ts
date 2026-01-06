import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { carts } from "./carts";
import { customers } from "./customers";

/**
 * Customer sessions table
 * Enhanced session tracking with device/browser metadata
 */
export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: text("session_id").notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    cartId: uuid("cart_id").references(() => carts.id, {
      onDelete: "set null",
    }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    deviceType: text("device_type"), // 'mobile', 'desktop', 'tablet'
    browser: text("browser"),
    os: text("os"),
    country: text("country"),
    city: text("city"),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    sessionIdIdx: index("customer_sessions_session_id_idx").on(table.sessionId),
    customerIdIdx: index("customer_sessions_customer_id_idx").on(
      table.customerId,
    ),
    cartIdIdx: index("customer_sessions_cart_id_idx").on(table.cartId),
    lastSeenAtIdx: index("customer_sessions_last_seen_at_idx").on(
      table.lastSeenAt,
    ),
    isActiveIdx: index("customer_sessions_is_active_idx").on(table.isActive),
  }),
);

export const customerSessionsRelations = relations(
  customerSessions,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerSessions.customerId],
      references: [customers.id],
    }),
    cart: one(carts, {
      fields: [customerSessions.cartId],
      references: [carts.id],
    }),
  }),
);

export type CustomerSession = typeof customerSessions.$inferSelect;
export type NewCustomerSession = typeof customerSessions.$inferInsert;
