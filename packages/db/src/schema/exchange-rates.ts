import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Exchange rates table
 * Stores FX rates between currency pairs
 */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromCurrency: text("from_currency").notNull(), // Source currency code (ISO 4217)
    toCurrency: text("to_currency").notNull(), // Target currency code (ISO 4217)
    rate: real("rate").notNull(), // Exchange rate (1 fromCurrency = rate toCurrency)
    source: text("source").notNull(), // Provider name (e.g., "exchange-rate-api", "fixer-io")
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    fromCurrencyIdx: index("exchange_rates_from_currency_idx").on(
      table.fromCurrency,
    ),
    toCurrencyIdx: index("exchange_rates_to_currency_idx").on(table.toCurrency),
    currencyPairIdx: index("exchange_rates_currency_pair_idx").on(
      table.fromCurrency,
      table.toCurrency,
    ),
    // Unique constraint on currency pair
    uniqueCurrencyPair: unique("exchange_rates_unique_pair").on(
      table.fromCurrency,
      table.toCurrency,
    ),
  }),
);

export const exchangeRatesRelations = relations(exchangeRates, () => ({}));

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
