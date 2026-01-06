import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { refunds } from "./refunds";

export const refundReconciliationStatusEnum = pgEnum(
  "refund_reconciliation_status",
  ["pending", "reconciled", "mismatch", "failed"],
);

export const refundReconciliation = pgTable(
  "refund_reconciliation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => refunds.id, { onDelete: "restrict" }),
    providerRefundId: text("provider_refund_id").notNull(), // External provider refund ID
    gateway: text("gateway").notNull(), // 'razorpay' | 'cashfree' | 'payu'
    expectedAmount: real("expected_amount").notNull(), // Amount we expected to refund
    actualAmount: real("actual_amount"), // Amount actually refunded by gateway
    status: refundReconciliationStatusEnum("status")
      .notNull()
      .default("pending"),
    reconciledAt: timestamp("reconciled_at"),
    notes: text("notes"),
    metadata: jsonb("metadata"), // Additional reconciliation data
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    refundIdIdx: index("refund_reconciliation_refund_id_idx").on(
      table.refundId,
    ),
    providerRefundIdIdx: index(
      "refund_reconciliation_provider_refund_id_idx",
    ).on(table.providerRefundId),
    gatewayIdx: index("refund_reconciliation_gateway_idx").on(table.gateway),
    statusIdx: index("refund_reconciliation_status_idx").on(table.status),
  }),
);

export const refundReconciliationRelations = relations(
  refundReconciliation,
  ({ one }) => ({
    refund: one(refunds, {
      fields: [refundReconciliation.refundId],
      references: [refunds.id],
    }),
  }),
);

export type RefundReconciliation = typeof refundReconciliation.$inferSelect;
export type NewRefundReconciliation = typeof refundReconciliation.$inferInsert;
