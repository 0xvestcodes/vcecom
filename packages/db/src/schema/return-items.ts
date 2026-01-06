import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { orderItems } from "./order-items";
import { returnRequests } from "./return-requests";

export const returnItemConditionEnum = pgEnum("return_item_condition", [
  "new",
  "damaged",
  "defective",
  "other",
]);

export const returnItemStatusEnum = pgEnum("return_item_status", [
  "pending",
  "approved",
  "rejected",
  "received",
  "refunded",
]);

export const returnItems = pgTable(
  "return_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    returnRequestId: uuid("return_request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    reason: text("reason").notNull(),
    condition: returnItemConditionEnum("condition").notNull().default("other"),
    refundAmount: real("refund_amount").notNull().default(0),
    status: returnItemStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    returnRequestIdIdx: index("return_items_return_request_id_idx").on(
      table.returnRequestId,
    ),
    orderItemIdIdx: index("return_items_order_item_id_idx").on(
      table.orderItemId,
    ),
    statusIdx: index("return_items_status_idx").on(table.status),
  }),
);

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  returnRequest: one(returnRequests, {
    fields: [returnItems.returnRequestId],
    references: [returnRequests.id],
  }),
  orderItem: one(orderItems, {
    fields: [returnItems.orderItemId],
    references: [orderItems.id],
  }),
}));

export type ReturnItem = typeof returnItems.$inferSelect;
export type NewReturnItem = typeof returnItems.$inferInsert;
