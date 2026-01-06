import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  real,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";

/**
 * Customer wallets table
 * Stores wallet balance (store credits) and loyalty points for each customer
 */
export const customerWallets = pgTable(
  "customer_wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" })
      .unique(),
    walletBalance: real("wallet_balance").notNull().default(0), // Store credits balance
    loyaltyPoints: integer("loyalty_points").notNull().default(0), // Loyalty points balance
    totalEarned: real("total_earned").notNull().default(0), // Lifetime credits earned
    totalRedeemed: real("total_redeemed").notNull().default(0), // Lifetime credits redeemed
    totalPointsEarned: integer("total_points_earned").notNull().default(0), // Lifetime points earned
    totalPointsRedeemed: integer("total_points_redeemed").notNull().default(0), // Lifetime points redeemed
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdIdx: index("customer_wallets_customer_id_idx").on(
      table.customerId,
    ),
  }),
);

export const customerWalletsRelations = relations(
  customerWallets,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerWallets.customerId],
      references: [customers.id],
    }),
  }),
);

export type CustomerWallet = typeof customerWallets.$inferSelect;
export type NewCustomerWallet = typeof customerWallets.$inferInsert;
