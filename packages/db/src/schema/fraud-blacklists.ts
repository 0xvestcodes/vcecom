import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const blacklistTypeEnum = pgEnum("blacklist_type", [
  "email",
  "phone",
  "address",
]);

export const fraudBlacklists = pgTable(
  "fraud_blacklists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: blacklistTypeEnum("type").notNull(),
    value: text("value").notNull(), // Normalized value (lowercase email, normalized phone, normalized address)
    reason: text("reason"), // Reason for blacklisting
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }), // Admin user who created the blacklist entry
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("fraud_blacklists_type_idx").on(table.type),
    valueIdx: index("fraud_blacklists_value_idx").on(table.value),
    typeValueIdx: index("fraud_blacklists_type_value_idx").on(
      table.type,
      table.value,
    ),
  }),
);

export const fraudBlacklistsRelations = relations(
  fraudBlacklists,
  ({ one }) => ({
    creator: one(users, {
      fields: [fraudBlacklists.createdBy],
      references: [users.id],
    }),
  }),
);

export type FraudBlacklist = typeof fraudBlacklists.$inferSelect;
export type NewFraudBlacklist = typeof fraudBlacklists.$inferInsert;
