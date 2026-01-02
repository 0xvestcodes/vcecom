import { index, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { entries } from "./entries";
import { users } from "./users";

export const lockTypeEnum = pgEnum("lock_type", ["hard", "soft"]);

export const entryEditLocks = pgTable(
  "entry_edit_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    lockedBy: uuid("locked_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lockType: lockTypeEnum("lock_type").notNull(), // 'hard' (user edit), 'soft' (system action)
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    entryIdIdx: index("entry_edit_locks_entry_id_idx").on(table.entryId),
    expiresAtIdx: index("entry_edit_locks_expires_at_idx").on(table.expiresAt),
  }),
);

export type EntryEditLock = typeof entryEditLocks.$inferSelect;
export type NewEntryEditLock = typeof entryEditLocks.$inferInsert;
