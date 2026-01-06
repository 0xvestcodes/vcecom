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
import { customers } from "./customers";
import { orders } from "./orders";
import { refunds } from "./refunds";

/**
 * Wallet transaction type enum
 */
export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
  "credit", // Wallet credited (refund, admin adjustment, promotion)
  "debit", // Wallet debited (purchase)
  "points_earned", // Points earned from purchase
  "points_redeemed", // Points redeemed for discount
  "refund", // Refund to wallet
  "admin_adjustment", // Admin manual adjustment
  "promotion", // Promotional credit
]);

/**
 * Wallet transactions table
 * Complete audit trail of all wallet and loyalty points transactions
 */
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: walletTransactionTypeEnum("type").notNull(),
    amount: real("amount").notNull().default(0), // For wallet transactions (credits/debits)
    points: integer("points").notNull().default(0), // For points transactions
    balanceAfter: real("balance_after").notNull(), // Wallet balance after transaction
    pointsAfter: integer("points_after").notNull(), // Points balance after transaction
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }), // Related order if applicable
    refundId: uuid("refund_id").references(() => refunds.id, {
      onDelete: "set null",
    }), // Related refund if applicable
    description: text("description").notNull(),
    metadata: jsonb("metadata").$type<{
      ruleId?: string;
      adminId?: string;
      originalAmount?: number;
      [key: string]: unknown;
    }>(), // Additional transaction details
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdIdx: index("wallet_transactions_customer_id_idx").on(
      table.customerId,
    ),
    orderIdIdx: index("wallet_transactions_order_id_idx").on(table.orderId),
    refundIdIdx: index("wallet_transactions_refund_id_idx").on(table.refundId),
    typeIdx: index("wallet_transactions_type_idx").on(table.type),
    createdAtIdx: index("wallet_transactions_created_at_idx").on(
      table.createdAt,
    ),
    customerTypeIdx: index("wallet_transactions_customer_type_idx").on(
      table.customerId,
      table.type,
    ),
  }),
);

export const walletTransactionsRelations = relations(
  walletTransactions,
  ({ one }) => ({
    customer: one(customers, {
      fields: [walletTransactions.customerId],
      references: [customers.id],
    }),
    order: one(orders, {
      fields: [walletTransactions.orderId],
      references: [orders.id],
    }),
    refund: one(refunds, {
      fields: [walletTransactions.refundId],
      references: [refunds.id],
    }),
  }),
);

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type NewWalletTransaction = typeof walletTransactions.$inferInsert;
