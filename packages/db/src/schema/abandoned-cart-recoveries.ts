import { relations } from "drizzle-orm";
import {
  index,
  integer,
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
 * Recovery status types
 */
export const recoveryStatusEnum = pgEnum("recovery_status", [
  "queued",
  "email_sent",
  "sms_sent",
  "recovered",
  "expired",
  "failed",
]);

/**
 * Abandoned cart recoveries table
 * Tracks recovery attempts and campaigns
 */
export const abandonedCartRecoveries = pgTable(
  "abandoned_cart_recoveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id"),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    recoveryStatus: recoveryStatusEnum("recovery_status")
      .notNull()
      .default("queued"),
    emailSentAt: timestamp("email_sent_at"),
    smsSentAt: timestamp("sms_sent_at"),
    recoveredAt: timestamp("recovered_at"),
    recoveryDiscountCode: text("recovery_discount_code"),
    recoveryAttempts: integer("recovery_attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at"),
    metadata: jsonb("metadata"), // Stores recovery campaign details
  },
  (table) => ({
    cartIdIdx: index("abandoned_cart_recoveries_cart_id_idx").on(table.cartId),
    customerIdIdx: index("abandoned_cart_recoveries_customer_id_idx").on(
      table.customerId,
    ),
    recoveryStatusIdx: index(
      "abandoned_cart_recoveries_recovery_status_idx",
    ).on(table.recoveryStatus),
    detectedAtIdx: index("abandoned_cart_recoveries_detected_at_idx").on(
      table.detectedAt,
    ),
    nextAttemptAtIdx: index("abandoned_cart_recoveries_next_attempt_at_idx").on(
      table.nextAttemptAt,
    ),
  }),
);

export const abandonedCartRecoveriesRelations = relations(
  abandonedCartRecoveries,
  ({ one }) => ({
    cart: one(carts, {
      fields: [abandonedCartRecoveries.cartId],
      references: [carts.id],
    }),
    customer: one(customers, {
      fields: [abandonedCartRecoveries.customerId],
      references: [customers.id],
    }),
  }),
);

export type AbandonedCartRecovery = typeof abandonedCartRecoveries.$inferSelect;
export type NewAbandonedCartRecovery =
  typeof abandonedCartRecoveries.$inferInsert;
