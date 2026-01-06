import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Tax exemption types - defines the level at which exemption applies
 */
export const taxExemptionTypeEnum = pgEnum("tax_exemption_type", [
  "CUSTOMER_GROUP",
  "CUSTOMER",
  "CATEGORY",
  "PRODUCT",
  "VARIANT",
]);

/**
 * Tax exemptions table
 * Stores tax exemptions for customers/products at different levels
 */
export const taxExemptions = pgTable(
  "tax_exemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    exemptionType: taxExemptionTypeEnum("exemption_type").notNull(),
    entityId: uuid("entity_id").notNull(), // ID of the entity (customer_group_id, customer_id, category_id, product_id, variant_id)
    exemptionReason: text("exemption_reason"), // Reason for exemption (e.g., "Export", "SEZ", "Government")
    certificateNumber: text("certificate_number"), // Certificate/document number for exemption
    isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = inactive
    startDate: timestamp("start_date"), // Optional: Exemption becomes active on this date
    endDate: timestamp("end_date"), // Optional: Exemption expires on this date
    metadata: jsonb("metadata"), // JSON object for flexible metadata storage
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    exemptionTypeIdx: index("tax_exemptions_exemption_type_idx").on(
      table.exemptionType,
    ),
    entityIdIdx: index("tax_exemptions_entity_id_idx").on(table.entityId),
    activeIdx: index("tax_exemptions_active_idx").on(table.isActive),
    startDateIdx: index("tax_exemptions_start_date_idx").on(table.startDate),
    endDateIdx: index("tax_exemptions_end_date_idx").on(table.endDate),
    certificateNumberIdx: index("tax_exemptions_certificate_number_idx").on(
      table.certificateNumber,
    ),
    // Composite index for efficient exemption resolution queries
    exemptionTypeEntityIdx: index(
      "tax_exemptions_exemption_type_entity_idx",
    ).on(table.exemptionType, table.entityId),
  }),
);

export const taxExemptionsRelations = relations(taxExemptions, () => ({}));

export type TaxExemption = typeof taxExemptions.$inferSelect;
export type NewTaxExemption = typeof taxExemptions.$inferInsert;
