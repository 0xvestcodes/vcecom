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
import { addresses } from "./addresses";
import { customers } from "./customers";
import { orders } from "./orders";
import { returnItems } from "./return-items";
import { users } from "./users";

export const returnRequestStatusEnum = pgEnum("return_request_status", [
  "pending",
  "approved",
  "rejected",
  "in_transit",
  "received",
  "processing_refund",
  "completed",
  "cancelled",
]);

export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    rmaNumber: text("rma_number").notNull().unique(),
    status: returnRequestStatusEnum("status").notNull().default("pending"),
    reason: text("reason").notNull(),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    approvedAt: timestamp("approved_at"),
    approvedBy: uuid("approved_by").references(() => users.id),
    rejectionReason: text("rejection_reason"),
    returnAddressId: uuid("return_address_id").references(() => addresses.id),
    trackingNumber: text("tracking_number"),
    receivedAt: timestamp("received_at"),
    completedAt: timestamp("completed_at"),
    metadata: jsonb("metadata"), // Additional return request data
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("return_requests_order_id_idx").on(table.orderId),
    customerIdIdx: index("return_requests_customer_id_idx").on(
      table.customerId,
    ),
    rmaNumberIdx: index("return_requests_rma_number_idx").on(table.rmaNumber),
    statusIdx: index("return_requests_status_idx").on(table.status),
    requestedAtIdx: index("return_requests_requested_at_idx").on(
      table.requestedAt,
    ),
  }),
);

export const returnRequestsRelations = relations(
  returnRequests,
  ({ one, many }) => ({
    order: one(orders, {
      fields: [returnRequests.orderId],
      references: [orders.id],
    }),
    customer: one(customers, {
      fields: [returnRequests.customerId],
      references: [customers.id],
    }),
    approvedByUser: one(users, {
      fields: [returnRequests.approvedBy],
      references: [users.id],
    }),
    returnAddress: one(addresses, {
      fields: [returnRequests.returnAddressId],
      references: [addresses.id],
    }),
    items: many(returnItems),
  }),
);

export type ReturnRequest = typeof returnRequests.$inferSelect;
export type NewReturnRequest = typeof returnRequests.$inferInsert;
