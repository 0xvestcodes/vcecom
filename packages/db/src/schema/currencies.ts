import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Currencies table
 * Stores supported currencies for the store
 */
export const currencies = pgTable(
  "currencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(), // ISO 4217 code (e.g., "USD", "INR")
    name: text("name").notNull(), // Full name (e.g., "US Dollar")
    symbol: text("symbol").notNull(), // Symbol (e.g., "$", "₹")
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false), // Only one default per store
    decimalPlaces: integer("decimal_places").notNull().default(2), // Decimal places for display
    exchangeRate: real("exchange_rate"), // Cached rate relative to store base currency (nullable)
    lastUpdated: timestamp("last_updated"), // When exchange rate was last updated
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index("currencies_code_idx").on(table.code),
    activeIdx: index("currencies_active_idx").on(table.isActive),
    defaultIdx: index("currencies_default_idx").on(table.isDefault),
  }),
);

export const currenciesRelations = relations(currencies, () => ({}));

export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;
