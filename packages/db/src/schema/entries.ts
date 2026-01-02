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
import { contentTypes } from "./content-types";
import { users } from "./users";

// Keep old enum for migration compatibility
export const entryStatusEnum = pgEnum("entry_status", ["draft", "published"]);

export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "review",
  "published",
]);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentTypes.id, { onDelete: "cascade" }),
    // Old fields - will be removed after migration
    status: entryStatusEnum("status").notNull().default("draft"),
    data: jsonb("data").notNull(), // Field values matching schema
    // New fields
    currentWorkflowStatus: workflowStatusEnum("current_workflow_status")
      .notNull()
      .default("draft"), // Denormalized workflow status for queries
    slug: text("slug"), // URL-friendly identifier (canonical slug from latest published)
    publishedAt: timestamp("published_at"), // When entry was last published
    themeId: text("theme_id"), // Optional: page-specific theme override
    // Page structure with sections and blocks
    structure: jsonb("structure").$type<{
      sections: Array<{
        id: string;
        layout: "container" | "full";
        background?: "accent" | "muted" | "primary" | "secondary";
        padding?: "xs" | "sm" | "md" | "lg" | "xl";
        blocks: Array<{
          id: string;
          type: string;
          order: number;
          props: Record<string, unknown>;
          style?: {
            variant?: "default" | "inset" | "card" | "section" | "ghost";
            padding?: "none" | "sm" | "md" | "lg";
            align?: "left" | "center" | "right";
          };
        }>;
      }>;
    }>(),
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
    contentTypeIdIdx: index("entries_content_type_id_idx").on(
      table.contentTypeId,
    ),
    statusIdx: index("entries_status_idx").on(table.status),
    workflowStatusIdx: index("entries_workflow_status_idx").on(
      table.currentWorkflowStatus,
    ),
    publishedAtIdx: index("entries_published_at_idx").on(table.publishedAt),
    slugIdx: index("entries_slug_idx").on(table.slug),
    contentTypeSlugIdx: index("entries_content_type_slug_idx").on(
      table.contentTypeId,
      table.slug,
    ),
  }),
);

export const entriesRelations = relations(entries, ({ one }) => ({
  contentType: one(contentTypes, {
    fields: [entries.contentTypeId],
    references: [contentTypes.id],
  }),
  creator: one(users, {
    fields: [entries.createdBy],
    references: [users.id],
    relationName: "entryCreator",
  }),
  updater: one(users, {
    fields: [entries.updatedBy],
    references: [users.id],
    relationName: "entryUpdater",
  }),
}));

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
