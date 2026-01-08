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
import { users } from "./users";

export const mediaGroups = pgTable(
  "media_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
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
    nameIdx: index("media_groups_name_idx").on(table.name),
    slugIdx: index("media_groups_slug_idx").on(table.slug),
    isActiveIdx: index("media_groups_is_active_idx").on(table.isActive),
    displayOrderIdx: index("media_groups_display_order_idx").on(
      table.displayOrder,
    ),
  }),
);

export const mediaGroupsRelations = relations(mediaGroups, ({ one }) => ({
  creator: one(users, {
    fields: [mediaGroups.createdBy],
    references: [users.id],
    relationName: "mediaGroupCreator",
  }),
  updater: one(users, {
    fields: [mediaGroups.updatedBy],
    references: [users.id],
    relationName: "mediaGroupUpdater",
  }),
}));

export type MediaGroup = typeof mediaGroups.$inferSelect;
export type NewMediaGroup = typeof mediaGroups.$inferInsert;
