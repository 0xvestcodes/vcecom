import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const contentTypes = pgTable(
  "content_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(), // e.g., "blog_post", "page", "navigation"
    displayName: text("display_name").notNull(), // e.g., "Blog Post"
    schema: jsonb("schema").notNull(), // Field definitions, validation rules, display fields
    isSingleton: boolean("is_singleton").notNull().default(false), // Single entry per type (e.g., homepage)
    isCollection: boolean("is_collection").notNull().default(true), // Multiple entries (e.g., blog posts)
    icon: text("icon"), // Icon identifier
    color: text("color"), // Color code
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    nameIdx: index("content_types_name_idx").on(table.name),
    createdAtIdx: index("content_types_created_at_idx").on(table.createdAt),
  }),
);

export const contentTypesRelations = relations(contentTypes, ({ one }) => ({
  creator: one(users, {
    fields: [contentTypes.createdBy],
    references: [users.id],
    relationName: "contentTypeCreator",
  }),
  updater: one(users, {
    fields: [contentTypes.updatedBy],
    references: [users.id],
    relationName: "contentTypeUpdater",
  }),
}));

export type ContentType = typeof contentTypes.$inferSelect;
export type NewContentType = typeof contentTypes.$inferInsert;
