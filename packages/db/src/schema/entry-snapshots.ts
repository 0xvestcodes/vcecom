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
import { entries } from "./entries";
import { users } from "./users";

export const snapshotTypeEnum = pgEnum("snapshot_type", [
  "draft",
  "review",
  "published",
]);

export const entrySnapshots = pgTable(
  "entry_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    snapshotType: snapshotTypeEnum("snapshot_type").notNull(),
    data: jsonb("data").notNull(), // Field values matching schema
    snapshotNumber: integer("snapshot_number").notNull().default(0), // Sequential for published snapshots
    frozenAt: timestamp("frozen_at"), // When snapshot was frozen (published/review snapshots)
    frozenReferences: jsonb("frozen_references"), // Frozen relation graph at snapshot creation
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    entryIdIdx: index("entry_snapshots_entry_id_idx").on(table.entryId),
    snapshotTypeIdx: index("entry_snapshots_snapshot_type_idx").on(
      table.snapshotType,
    ),
    entrySnapshotNumberIdx: index("entry_snapshots_entry_number_idx").on(
      table.entryId,
      table.snapshotNumber,
    ),
    frozenAtIdx: index("entry_snapshots_frozen_at_idx").on(table.frozenAt),
  }),
);

// Note: Partial unique index for draft/review will be created manually in migration
// Drizzle doesn't support conditional unique indexes directly

export const entrySnapshotsRelations = relations(entrySnapshots, ({ one }) => ({
  entry: one(entries, {
    fields: [entrySnapshots.entryId],
    references: [entries.id],
  }),
  creator: one(users, {
    fields: [entrySnapshots.createdBy],
    references: [users.id],
    relationName: "snapshotCreator",
  }),
  reviewer: one(users, {
    fields: [entrySnapshots.reviewedBy],
    references: [users.id],
    relationName: "snapshotReviewer",
  }),
}));

export type EntrySnapshot = typeof entrySnapshots.$inferSelect;
export type NewEntrySnapshot = typeof entrySnapshots.$inferInsert;
