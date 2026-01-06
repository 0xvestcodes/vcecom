import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { productVariants } from "./product-variants";
import { stores } from "./stores";

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id").references(() => stores.id, {
      onDelete: "cascade",
    }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productVariantId: uuid("product_variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    price: real("price").notNull(),
    gstRate: real("gst_rate").notNull().default(0),
    gstAmount: real("gst_amount").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("order_items_store_id_idx").on(table.storeId),
    orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
    productVariantIdIdx: index("order_items_product_variant_id_idx").on(
      table.productVariantId,
    ),
  }),
);

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  store: one(stores, {
    fields: [orderItems.storeId],
    references: [stores.id],
  }),
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  productVariant: one(productVariants, {
    fields: [orderItems.productVariantId],
    references: [productVariants.id],
  }),
}));

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
