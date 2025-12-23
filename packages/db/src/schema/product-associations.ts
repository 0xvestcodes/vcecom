import { relations } from "drizzle-orm";
import { index, pgTable, real, timestamp, uuid } from "drizzle-orm/pg-core";
import { products } from "./products";

/**
 * Product associations table
 * Stores frequently bought together relationships between products
 */
export const productAssociations = pgTable(
  "product_associations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    associatedProductId: uuid("associated_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    frequencyCount: real("frequency_count").notNull().default(1),
    confidenceScore: real("confidence_score"), // 0-1 score
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("product_associations_product_id_idx").on(
      table.productId,
    ),
    associatedProductIdIdx: index(
      "product_associations_associated_product_id_idx",
    ).on(table.associatedProductId),
    uniqueProductAssociation: index("product_associations_unique_idx").on(
      table.productId,
      table.associatedProductId,
    ),
    confidenceScoreIdx: index("product_associations_confidence_score_idx").on(
      table.confidenceScore,
    ),
  }),
);

export const productAssociationsRelations = relations(
  productAssociations,
  ({ one }) => ({
    product: one(products, {
      fields: [productAssociations.productId],
      references: [products.id],
    }),
    associatedProduct: one(products, {
      fields: [productAssociations.associatedProductId],
      references: [products.id],
    }),
  }),
);

export type ProductAssociation = typeof productAssociations.$inferSelect;
export type NewProductAssociation = typeof productAssociations.$inferInsert;
