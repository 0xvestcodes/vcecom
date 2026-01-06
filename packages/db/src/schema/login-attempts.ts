import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const loginAttemptStatusEnum = pgEnum("login_attempt_status", [
  "SUCCESS",
  "FAILED",
  "BLOCKED",
]);

/**
 * Login Attempts table
 * Tracks all admin login attempts for anomaly detection
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id").references(() => users.id, {
      onDelete: "set null",
    }), // null for failed attempts
    email: text("email").notNull(), // Email used in login attempt
    status: loginAttemptStatusEnum("status").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    deviceId: text("device_id"),
    sessionId: uuid("session_id"), // Session created on successful login
    failureReason: text("failure_reason"), // Reason for failure (invalid password, 2FA failed, etc.)
    anomalyScore: text("anomaly_score"), // Anomaly detection score (0-100)
    anomalyFlags: jsonb("anomaly_flags"), // Array of detected anomalies
    metadata: jsonb("metadata"), // Additional context (geolocation, etc.)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    adminIdIdx: index("idx_login_attempts_adminId").on(table.adminId),
    emailIdx: index("idx_login_attempts_email").on(table.email),
    statusIdx: index("idx_login_attempts_status").on(table.status),
    ipAddressIdx: index("idx_login_attempts_ipAddress").on(table.ipAddress),
    createdAtIdx: index("idx_login_attempts_createdAt").on(table.createdAt),
    emailCreatedAtIdx: index("idx_login_attempts_email_createdAt").on(
      table.email,
      table.createdAt,
    ),
  }),
);

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type NewLoginAttempt = typeof loginAttempts.$inferInsert;
