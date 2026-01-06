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
import { webhooks } from "./webhooks";

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "success",
  "failed",
]);

export const webhookDeliveryLogs = pgTable(
  "webhook_delivery_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(), // e.g., "order.created", "product.updated"
    eventId: text("event_id").notNull(), // ID of the order/product/customer that triggered the event
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(1),
    responseStatus: integer("response_status"), // HTTP status code
    responseBody: text("response_body"), // Response body (truncated if too long)
    requestBody: jsonb("request_body").notNull(), // Full request payload
    errorMessage: text("error_message"), // Error message if failed
    deliveredAt: timestamp("delivered_at"), // When webhook was successfully delivered
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    webhookIdIdx: index("idx_webhook_delivery_logs_webhookId").on(
      table.webhookId,
    ),
    statusIdx: index("idx_webhook_delivery_logs_status").on(table.status),
    createdAtIdx: index("idx_webhook_delivery_logs_createdAt").on(
      table.createdAt,
    ),
    eventIdIdx: index("idx_webhook_delivery_logs_eventId").on(table.eventId),
    eventTypeIdx: index("idx_webhook_delivery_logs_eventType").on(
      table.eventType,
    ),
  }),
);

export const webhookDeliveryLogsRelations = relations(
  webhookDeliveryLogs,
  ({ one }) => ({
    webhook: one(webhooks, {
      fields: [webhookDeliveryLogs.webhookId],
      references: [webhooks.id],
    }),
  }),
);

export type WebhookDeliveryLog = typeof webhookDeliveryLogs.$inferSelect;
export type NewWebhookDeliveryLog = typeof webhookDeliveryLogs.$inferInsert;
