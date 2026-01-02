import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entries } from "./entries";

export const relationTypeEnum = pgEnum("relation_type", [
  "one_to_one",
  "one_to_many",
  "many_to_many",
]);

export const entryRelations = pgTable(
  "entry_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceEntryId: uuid("source_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    targetEntryId: uuid("target_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    relationType: relationTypeEnum("relation_type").notNull(),
    fieldName: text("field_name").notNull(), // Field name in source entry schema
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceEntryIdIdx: index("entry_relations_source_entry_id_idx").on(
      table.sourceEntryId,
    ),
    targetEntryIdIdx: index("entry_relations_target_entry_id_idx").on(
      table.targetEntryId,
    ),
    sourceFieldIdx: index("entry_relations_source_field_idx").on(
      table.sourceEntryId,
      table.fieldName,
    ),
  }),
);

export const entryRelationsRelations = relations(entryRelations, ({ one }) => ({
  sourceEntry: one(entries, {
    fields: [entryRelations.sourceEntryId],
    references: [entries.id],
    relationName: "sourceEntry",
  }),
  targetEntry: one(entries, {
    fields: [entryRelations.targetEntryId],
    references: [entries.id],
    relationName: "targetEntry",
  }),
}));

export type EntryRelation = typeof entryRelations.$inferSelect;
export type NewEntryRelation = typeof entryRelations.$inferInsert;
