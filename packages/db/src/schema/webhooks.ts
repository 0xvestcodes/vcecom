import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { webhookDeliveryLogs } from "./webhook-delivery-logs";

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    events: jsonb("events").$type<string[]>().notNull(), // Array of event types
    secret: text("secret").notNull(), // Secret for HMAC signing
    isActive: boolean("is_active").notNull().default(true),
    timeoutMs: integer("timeout_ms").notNull().default(30000), // Default 30 seconds
    retryConfig: jsonb("retry_config")
      .$type<{
        maxAttempts: number;
        backoffMs: number[]; // Array of delays in milliseconds for each retry
      }>()
      .notNull()
      .default({
        maxAttempts: 5,
        backoffMs: [1000, 5000, 30000, 300000, 1800000], // 1s, 5s, 30s, 5m, 30m
      }),
    headers: jsonb("headers").$type<Record<string, string>>(), // Custom headers
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("idx_webhooks_storeId").on(table.storeId),
    isActiveIdx: index("idx_webhooks_isActive").on(table.isActive),
    eventsIdx: index("idx_webhooks_events").using("gin", table.events), // GIN index for JSONB array
  }),
);

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  store: one(stores, {
    fields: [webhooks.storeId],
    references: [stores.id],
  }),
  deliveryLogs: many(webhookDeliveryLogs),
}));

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
