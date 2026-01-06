import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    signature: text("signature"), // HMAC signature for tamper detection
    deviceId: text("device_id").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
  },
  (table) => ({
    adminIdIdx: index("idx_admin_sessions_adminId").on(table.adminId),
    deviceIdIdx: index("idx_admin_sessions_deviceId").on(table.deviceId),
    refreshTokenHashIdx: index("idx_admin_sessions_refreshTokenHash").on(
      table.refreshTokenHash,
    ),
  }),
);

export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;

export interface SessionInfo {
  id: string;
  deviceId: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
}
