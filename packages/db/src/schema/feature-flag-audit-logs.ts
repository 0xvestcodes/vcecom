import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { featureFlagScopeTypeEnum } from "./feature-flag-overrides";
import { users } from "./users";

export const featureFlagAuditLogs = pgTable(
  "feature_flag_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    featureKey: text("feature_key").notNull(),
    scopeType: featureFlagScopeTypeEnum("scope_type"),
    scopeId: text("scope_id"),
    oldState: boolean("old_state"), // nullable for new overrides
    newState: boolean("new_state").notNull(),
    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    changeReason: text("change_reason"), // Optional reason for the change
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    featureKeyIdx: index("feature_flag_audit_logs_feature_key_idx").on(
      table.featureKey,
    ),
    createdAtIdx: index("feature_flag_audit_logs_created_at_idx").on(
      table.createdAt,
    ),
    changedByIdx: index("feature_flag_audit_logs_changed_by_idx").on(
      table.changedBy,
    ),
  }),
);

export type FeatureFlagAuditLog = typeof featureFlagAuditLogs.$inferSelect;
export type NewFeatureFlagAuditLog = typeof featureFlagAuditLogs.$inferInsert;
