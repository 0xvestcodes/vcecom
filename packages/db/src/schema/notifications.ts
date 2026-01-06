import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const notificationTypeEnum = pgEnum("notification_type", [
  "ORDER",
  "INVENTORY",
  "REVIEW",
  "SHIPPING",
  "PAYMENT",
  "SYSTEM",
  "SECURITY",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id").references(() => users.id, {
      onDelete: "set null",
    }), // null for broadcast notifications
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(), // max 120 chars
    message: text("message").notNull(),
    meta: jsonb("meta"), // Additional metadata
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    adminIdIdx: index("idx_notifications_adminId").on(table.adminId),
    readIdx: index("idx_notifications_read").on(table.read),
    createdAtIdx: index("idx_notifications_createdAt").on(table.createdAt),
    typeIdx: index("idx_notifications_type").on(table.type),
    // Composite index for common query pattern: unread notifications for admin
    adminReadIdx: index("idx_notifications_adminId_read").on(
      table.adminId,
      table.read,
    ),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
