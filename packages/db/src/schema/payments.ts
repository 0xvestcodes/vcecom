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
import { orders } from "./orders";
import { stores } from "./stores";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "razorpay",
  "cod",
  "upi",
  "card",
  "netbanking",
  "wallet",
  "razorpay_upi",
  "razorpay_card",
  "stripe_card",
  "cashfree",
  "cashfree_upi",
  "cashfree_card",
  "payu",
  "payu_upi",
  "payu_card",
  "payu_netbanking",
  "payu_wallet",
  "bnpl",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id").references(() => stores.id, {
      onDelete: "cascade",
    }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    razorpayOrderId: text("razorpay_order_id"),
    cashfreePaymentId: text("cashfree_payment_id").unique(),
    cashfreeOrderId: text("cashfree_order_id"),
    payuPaymentId: text("payu_payment_id").unique(),
    payuTxnId: text("payu_txn_id"),
    paymentGateway: text("payment_gateway"), // 'razorpay' | 'cashfree' | 'payu' | etc.
    metadata: jsonb("metadata"), // Additional payment gateway specific data
    amount: real("amount").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    method: paymentMethodEnum("method").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("payments_store_id_idx").on(table.storeId),
    orderIdIdx: index("payments_order_id_idx").on(table.orderId),
    razorpayPaymentIdIdx: index("payments_razorpay_payment_id_idx").on(
      table.razorpayPaymentId,
    ),
    razorpayOrderIdIdx: index("payments_razorpay_order_id_idx").on(
      table.razorpayOrderId,
    ),
    cashfreePaymentIdIdx: index("payments_cashfree_payment_id_idx").on(
      table.cashfreePaymentId,
    ),
    cashfreeOrderIdIdx: index("payments_cashfree_order_id_idx").on(
      table.cashfreeOrderId,
    ),
    payuPaymentIdIdx: index("payments_payu_payment_id_idx").on(
      table.payuPaymentId,
    ),
    payuTxnIdIdx: index("payments_payu_txn_id_idx").on(table.payuTxnId),
    statusIdx: index("payments_status_idx").on(table.status),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  store: one(stores, {
    fields: [payments.storeId],
    references: [stores.id],
  }),
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
