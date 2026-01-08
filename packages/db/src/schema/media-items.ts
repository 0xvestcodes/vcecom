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
import { mediaGroups } from "./media-groups";
import { users } from "./users";

export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => mediaGroups.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    altText: text("alt_text"),
    caption: text("caption"),
    displayOrder: integer("display_order").notNull().default(0),
    linkUrl: text("link_url"),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
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
    groupIdIdx: index("media_items_group_id_idx").on(table.groupId),
    groupIdDisplayOrderIdx: index("media_items_group_id_display_order_idx").on(
      table.groupId,
      table.displayOrder,
    ),
    isActiveIdx: index("media_items_is_active_idx").on(table.isActive),
  }),
);

export const mediaItemsRelations = relations(mediaItems, ({ one }) => ({
  group: one(mediaGroups, {
    fields: [mediaItems.groupId],
    references: [mediaGroups.id],
  }),
  creator: one(users, {
    fields: [mediaItems.createdBy],
    references: [users.id],
    relationName: "mediaItemCreator",
  }),
  updater: one(users, {
    fields: [mediaItems.updatedBy],
    references: [users.id],
    relationName: "mediaItemUpdater",
  }),
}));

export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;
