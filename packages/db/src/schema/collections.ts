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
import { productCollections } from "./product-collections";
import { stores } from "./stores";

export const collectionTypeEnum = pgEnum("collection_type", [
  "manual",
  "automatic",
]);

export const collectionMatchTypeEnum = pgEnum("collection_match_type", [
  "all",
  "any",
]);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id").references(() => stores.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    type: collectionTypeEnum("type").notNull().default("manual"),
    rules:
      jsonb("rules").$type<
        Array<{
          field: string;
          operator: string;
          value: string | number;
        }>
      >(),
    matchType: collectionMatchTypeEnum("match_type").default("all"),
    position: integer("position").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("collections_store_id_idx").on(table.storeId),
    slugIdx: index("collections_slug_idx").on(table.slug),
    typeIdx: index("collections_type_idx").on(table.type),
    positionIdx: index("collections_position_idx").on(table.position),
    storeIdSlugIdx: index("collections_store_id_slug_idx").on(
      table.storeId,
      table.slug,
    ),
  }),
);

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  store: one(stores, {
    fields: [collections.storeId],
    references: [stores.id],
  }),
  products: many(productCollections),
}));

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
