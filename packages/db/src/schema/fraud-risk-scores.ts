import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { users } from "./users";

export const fraudRiskScores = pgTable(
  "fraud_risk_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" })
      .unique(),
    riskScore: integer("risk_score").notNull().default(0), // 0-100 scale
    riskFactors: jsonb("risk_factors").notNull().default({}), // JSON object with risk factor details
    flagged: boolean("flagged").notNull().default(false), // Whether order was flagged for review
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }), // Admin user who reviewed the order
    reviewedAt: timestamp("reviewed_at"), // When order was reviewed
    reviewNotes: text("review_notes"), // Notes from admin review
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("fraud_risk_scores_order_id_idx").on(table.orderId),
    riskScoreIdx: index("fraud_risk_scores_risk_score_idx").on(table.riskScore),
    flaggedIdx: index("fraud_risk_scores_flagged_idx").on(table.flagged),
    reviewedByIdx: index("fraud_risk_scores_reviewed_by_idx").on(
      table.reviewedBy,
    ),
  }),
);

export const fraudRiskScoresRelations = relations(
  fraudRiskScores,
  ({ one }) => ({
    order: one(orders, {
      fields: [fraudRiskScores.orderId],
      references: [orders.id],
    }),
    reviewer: one(users, {
      fields: [fraudRiskScores.reviewedBy],
      references: [users.id],
    }),
  }),
);

export type FraudRiskScore = typeof fraudRiskScores.$inferSelect;
export type NewFraudRiskScore = typeof fraudRiskScores.$inferInsert;
