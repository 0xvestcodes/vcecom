import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entries } from "./entries";
import { users } from "./users";

export const entryRevisions = pgTable(
  "entry_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(), // Sequential revision number
    data: jsonb("data").notNull(), // Snapshot of entry data at this revision
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    entryIdIdx: index("entry_revisions_entry_id_idx").on(table.entryId),
    entryRevisionIdx: index("entry_revisions_entry_revision_idx").on(
      table.entryId,
      table.revisionNumber,
    ),
  }),
);

export const entryRevisionsRelations = relations(entryRevisions, ({ one }) => ({
  entry: one(entries, {
    fields: [entryRevisions.entryId],
    references: [entries.id],
  }),
  creator: one(users, {
    fields: [entryRevisions.createdBy],
    references: [users.id],
    relationName: "revisionCreator",
  }),
}));

export type EntryRevision = typeof entryRevisions.$inferSelect;
export type NewEntryRevision = typeof entryRevisions.$inferInsert;
