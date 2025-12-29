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
import { orders } from "./orders";

/**
 * Timeline event types
 * Matches TimelineEventType enum from order-timeline.dto.ts
 */
export const timelineEventTypeEnum = pgEnum("timeline_event_type", [
  "order_created",
  "order_confirmed",
  "order_processing",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "status_changed",
  "payment_intent_created",
  "payment_initiated",
  "payment_completed",
  "payment_failed",
  "order_marked_paid",
  "cart_snapshot",
  "inventory_reserved",
  "shipment_created",
  "shipment_tracking_updated",
  "shipment_label_generated",
  "shipment_picked_up",
  "shipment_in_transit",
  "shipment_out_for_delivery",
  "shipment_delivered",
  "shipment_failed",
  "shipment_returned",
  "shipment_cancelled",
  "note_added",
  "admin_note_added",
  "address_updated",
  "refund_created",
  "refund_processed",
  "rate_limit_triggered",
  "checkout_merged",
  "guest_checkout_detected",
  "abandoned_checkout_recovered",
]);

/**
 * Order timeline events table
 * Stores chronological events for order tracking and history
 */
export const orderTimeline = pgTable(
  "order_timeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: timelineEventTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    actor: text("actor"), // 'system', 'admin', 'customer', 'guest'
    actorId: uuid("actor_id"), // User ID, admin ID, or customer ID
    metadata: jsonb("metadata"), // Flexible metadata storage
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("order_timeline_order_id_idx").on(table.orderId),
    typeIdx: index("order_timeline_type_idx").on(table.type),
    timestampIdx: index("order_timeline_timestamp_idx").on(table.timestamp),
    orderIdTimestampIdx: index("order_timeline_order_id_timestamp_idx").on(
      table.orderId,
      table.timestamp,
    ),
  }),
);

export const orderTimelineRelations = relations(orderTimeline, ({ one }) => ({
  order: one(orders, {
    fields: [orderTimeline.orderId],
    references: [orders.id],
  }),
}));

export type OrderTimelineEvent = typeof orderTimeline.$inferSelect;
export type NewOrderTimelineEvent = typeof orderTimeline.$inferInsert;
