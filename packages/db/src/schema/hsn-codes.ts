import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * HSN codes table
 * Stores HSN (Harmonized System of Nomenclature) code master data
 * HSN codes are 8-digit numeric codes used for GST classification in India
 */
export const hsnCodes = pgTable(
  "hsn_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    hsnCode: text("hsn_code").notNull().unique(), // 8-digit numeric code
    description: text("description"), // Description of the HSN code
    gstRate: real("gst_rate"), // Default GST rate for this HSN code (can be overridden by tax rules)
    isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = inactive
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    hsnCodeIdx: index("hsn_codes_hsn_code_idx").on(table.hsnCode),
    activeIdx: index("hsn_codes_active_idx").on(table.isActive),
  }),
);

export const hsnCodesRelations = relations(hsnCodes, () => ({}));

export type HsnCode = typeof hsnCodes.$inferSelect;
export type NewHsnCode = typeof hsnCodes.$inferInsert;
