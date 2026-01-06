import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const apiKeyStatusEnum = pgEnum("api_key_status", [
  "active",
  "revoked",
  "expired",
]);

export const apiKeyTypeEnum = pgEnum("api_key_type", [
  "read",
  "write",
  "admin",
]);

/**
 * API Keys table
 * Stores API keys for programmatic access to the API
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // Human-readable name for the key
    keyHash: text("key_hash").notNull().unique(), // Hashed API key
    keyPrefix: text("key_prefix").notNull(), // First 8 chars for display (e.g., "vce_1234")
    type: apiKeyTypeEnum("type").notNull().default("read"), // read, write, admin
    status: apiKeyStatusEnum("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at"), // Track last usage
    expiresAt: timestamp("expires_at"), // Optional expiration
    scopes: text("scopes"), // JSON array of allowed scopes/permissions
    rateLimit: text("rate_limit"), // JSON object with rate limit config
    metadata: text("metadata"), // JSON object for additional metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"), // When key was revoked
    revokedBy: uuid("revoked_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    userIdIdx: index("api_keys_user_id_idx").on(table.userId),
    keyHashIdx: index("api_keys_key_hash_idx").on(table.keyHash),
    statusIdx: index("api_keys_status_idx").on(table.status),
  }),
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  revokedByUser: one(users, {
    fields: [apiKeys.revokedBy],
    references: [users.id],
  }),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
