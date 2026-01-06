import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { featureFlagOverrides } from "./feature-flag-overrides";
import { users } from "./users";

export const featureFlagTypeEnum = pgEnum("feature_flag_type", [
  "global",
  "store",
  "admin",
  "env",
]);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull().unique(), // e.g., "returns_module", "new_pricing_engine"
    description: text("description").notNull(),
    type: featureFlagTypeEnum("type").notNull().default("global"),
    defaultState: boolean("default_state").notNull().default(false),
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
    keyIdx: index("feature_flags_key_idx").on(table.key),
    typeIdx: index("feature_flags_type_idx").on(table.type),
  }),
);

export const featureFlagsRelations = relations(
  featureFlags,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [featureFlags.createdBy],
      references: [users.id],
    }),
    updater: one(users, {
      fields: [featureFlags.updatedBy],
      references: [users.id],
    }),
    overrides: many(featureFlagOverrides),
  }),
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
