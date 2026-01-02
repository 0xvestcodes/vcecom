import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const entityTypeEnum = pgEnum("entity_type", [
  "product",
  "collection",
  "cms_page",
]);

export const routeRegistry = pgTable(
  "route_registry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(), // Actual slug value, e.g., "my-product-slug"
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(), // UUID reference to product/collection/entry
    pattern: text("pattern").notNull(), // e.g., "/products/[slug]"
    redirectTo: text("redirect_to"), // New slug if this is a fallback redirect
    isFallback: boolean("is_fallback").notNull().default(false), // true if this is an old slug → redirect
    locale: text("locale"), // For future i18n support
    isDefaultLocale: boolean("is_default_locale").notNull().default(true), // true if default locale
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("route_registry_slug_idx").on(table.slug),
    entityTypeIdx: index("route_registry_entity_type_idx").on(table.entityType),
    entityIdIdx: index("route_registry_entity_id_idx").on(table.entityId),
    patternIdx: index("route_registry_pattern_idx").on(table.pattern),
    localeIdx: index("route_registry_locale_idx").on(table.locale),
    slugPatternIdx: index("route_registry_slug_pattern_idx").on(
      table.slug,
      table.pattern,
    ),
    fallbackIdx: index("route_registry_fallback_idx").on(table.isFallback),
  }),
);

export const routeRegistryRelations = relations(routeRegistry, () => ({}));

export type RouteRegistryEntry = typeof routeRegistry.$inferSelect;
export type NewRouteRegistryEntry = typeof routeRegistry.$inferInsert;
