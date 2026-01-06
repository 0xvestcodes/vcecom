import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const velocityCheckTypeEnum = pgEnum("velocity_check_type", [
  "order",
  "payment",
  "return",
]);

export const fraudVelocityChecks = pgTable(
  "fraud_velocity_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    checkType: velocityCheckTypeEnum("check_type").notNull(),
    count: integer("count").notNull().default(1), // Number of occurrences in the window
    windowStart: timestamp("window_start").notNull(), // Start of the time window
    windowEnd: timestamp("window_end").notNull(), // End of the time window
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdIdx: index("fraud_velocity_checks_customer_id_idx").on(
      table.customerId,
    ),
    checkTypeIdx: index("fraud_velocity_checks_check_type_idx").on(
      table.checkType,
    ),
    customerTypeIdx: index("fraud_velocity_checks_customer_type_idx").on(
      table.customerId,
      table.checkType,
    ),
    windowIdx: index("fraud_velocity_checks_window_idx").on(
      table.windowStart,
      table.windowEnd,
    ),
  }),
);

export const fraudVelocityChecksRelations = relations(
  fraudVelocityChecks,
  ({ one }) => ({
    customer: one(customers, {
      fields: [fraudVelocityChecks.customerId],
      references: [customers.id],
    }),
  }),
);

export type FraudVelocityCheck = typeof fraudVelocityChecks.$inferSelect;
export type NewFraudVelocityCheck = typeof fraudVelocityChecks.$inferInsert;
