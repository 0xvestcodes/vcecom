import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entries } from "./entries";

export const slugRedirects = pgTable(
  "slug_redirects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    oldSlug: text("old_slug").notNull(),
    newSlug: text("new_slug").notNull(),
    snapshotNumber: integer("snapshot_number"), // Which published snapshot this redirect applies to
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    entryIdIdx: index("slug_redirects_entry_id_idx").on(table.entryId),
    oldSlugIdx: index("slug_redirects_old_slug_idx").on(table.oldSlug),
    entryOldSlugIdx: index("slug_redirects_entry_old_slug_idx").on(
      table.entryId,
      table.oldSlug,
    ),
  }),
);

export type SlugRedirect = typeof slugRedirects.$inferSelect;
export type NewSlugRedirect = typeof slugRedirects.$inferInsert;
