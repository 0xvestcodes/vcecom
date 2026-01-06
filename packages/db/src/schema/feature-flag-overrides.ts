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
import { featureFlags } from "./feature-flags";
import { users } from "./users";

export const featureFlagScopeTypeEnum = pgEnum("feature_flag_scope_type", [
  "admin",
  "store",
  "environment",
]);

export const featureFlagOverrides = pgTable(
  "feature_flag_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    featureKey: text("feature_key")
      .notNull()
      .references(() => featureFlags.key, { onDelete: "cascade" }),
    scopeType: featureFlagScopeTypeEnum("scope_type").notNull(),
    scopeId: text("scope_id").notNull(), // Admin ID, Store ID, or environment name
    state: boolean("state").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => ({
    featureKeyScopeIdx: index(
      "feature_flag_overrides_feature_key_scope_idx",
    ).on(table.featureKey, table.scopeType, table.scopeId),
    featureKeyIdx: index("feature_flag_overrides_feature_key_idx").on(
      table.featureKey,
    ),
    scopeIdx: index("feature_flag_overrides_scope_idx").on(
      table.scopeType,
      table.scopeId,
    ),
  }),
);

export const featureFlagOverridesRelations = relations(
  featureFlagOverrides,
  ({ one }) => ({
    featureFlag: one(featureFlags, {
      fields: [featureFlagOverrides.featureKey],
      references: [featureFlags.key],
    }),
    creator: one(users, {
      fields: [featureFlagOverrides.createdBy],
      references: [users.id],
    }),
  }),
);

export type FeatureFlagOverride = typeof featureFlagOverrides.$inferSelect;
export type NewFeatureFlagOverride = typeof featureFlagOverrides.$inferInsert;
