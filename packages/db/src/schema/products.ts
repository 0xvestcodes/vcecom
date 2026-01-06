import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { stores } from "./stores";

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "archived",
]);

export const pricingTypeEnum = pgEnum("pricing_type", [
  "inclusive",
  "exclusive",
]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id").references(() => stores.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    price: real("price").notNull(),
    gstRate: real("gst_rate").notNull().default(0),
    pricingType: pricingTypeEnum("pricing_type").notNull().default("exclusive"),
    hsnCode: text("hsn_code"),
    slug: text("slug"), // URL-friendly identifier for products
    status: productStatusEnum("status").notNull().default("draft"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    /**
     * Digital product flag - if true, product is digital (e.g., software, ebooks)
     * Digital products cannot use COD payment method
     */
    isDigital: boolean("is_digital").notNull().default(false),
    /**
     * Preorder product flag - if true, product is a preorder
     * Preorder products cannot use COD payment method
     */
    isPreorder: boolean("is_preorder").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("products_store_id_idx").on(table.storeId),
    categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
    statusIdx: index("products_status_idx").on(table.status),
    hsnCodeIdx: index("products_hsn_code_idx").on(table.hsnCode),
    slugIdx: index("products_slug_idx").on(table.slug),
    storeIdSlugIdx: index("products_store_id_slug_idx").on(
      table.storeId,
      table.slug,
    ),
  }),
);

export const productsRelations = relations(products, ({ one }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
