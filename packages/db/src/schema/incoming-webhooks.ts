import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const incomingWebhookProviderEnum = pgEnum("incoming_webhook_provider", [
  "razorpay",
  "shiprocket",
  "nimbus_post",
  "generic",
]);

export const incomingWebhookStatusEnum = pgEnum("incoming_webhook_status", [
  "pending",
  "processed",
  "failed",
]);

export const incomingWebhooks = pgTable(
  "incoming_webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    provider: incomingWebhookProviderEnum("provider").notNull(),
    eventType: text("event_type").notNull(), // Provider-specific event type
    payload: jsonb("payload").notNull(), // Full webhook payload
    signature: text("signature"), // Signature from provider for validation
    headers: jsonb("headers").$type<Record<string, string>>(), // Request headers
    status: incomingWebhookStatusEnum("status").notNull().default("pending"),
    processedAt: timestamp("processed_at"), // When webhook was processed
    errorMessage: text("error_message"), // Error message if processing failed
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("idx_incoming_webhooks_storeId").on(table.storeId),
    providerIdx: index("idx_incoming_webhooks_provider").on(table.provider),
    statusIdx: index("idx_incoming_webhooks_status").on(table.status),
    createdAtIdx: index("idx_incoming_webhooks_createdAt").on(table.createdAt),
    eventTypeIdx: index("idx_incoming_webhooks_eventType").on(table.eventType),
  }),
);

export type IncomingWebhook = typeof incomingWebhooks.$inferSelect;
export type NewIncomingWebhook = typeof incomingWebhooks.$inferInsert;
