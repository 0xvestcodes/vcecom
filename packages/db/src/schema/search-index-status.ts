import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const searchIndexEntityTypeEnum = pgEnum("entity_type", [
  "product",
  "collection",
  "variant",
]);

export const indexStatusEnum = pgEnum("index_status", [
  "pending",
  "indexed",
  "failed",
]);

export const searchIndexStatus = pgTable(
  "search_index_status",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: searchIndexEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    indexedAt: timestamp("indexed_at"),
    indexVersion: text("index_version"),
    status: indexStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    entityTypeEntityIdIdx: index(
      "search_index_status_entity_type_entity_id_idx",
    ).on(table.entityType, table.entityId),
    statusIdx: index("search_index_status_status_idx").on(table.status),
    indexedAtIdx: index("search_index_status_indexed_at_idx").on(
      table.indexedAt,
    ),
  }),
);

export const searchIndexStatusRelations = relations(
  searchIndexStatus,
  () => ({}),
);

export type SearchIndexStatus = typeof searchIndexStatus.$inferSelect;
export type NewSearchIndexStatus = typeof searchIndexStatus.$inferInsert;
