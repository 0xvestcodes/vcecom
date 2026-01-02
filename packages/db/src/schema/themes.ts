import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";

/**
 * Themes table - stores theme instances and their settings
 * Each row represents a theme instance (e.g., "Modern Theme" for Store A)
 */
export const themes = pgTable(
  "themes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .references(() => stores.id, { onDelete: "cascade" })
      .notNull(),
    themeId: text("theme_id").notNull(), // References theme package (e.g., "modern", "minimal")
    name: text("name").notNull(), // Display name (e.g., "Modern Theme")
    isActive: boolean("is_active").default(false).notNull(), // Active theme for the store
    // Settings overrides (merges with theme.json defaults)
    settings: jsonb("settings").$type<{
      colors?: Partial<{
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        foreground: string;
        muted?: string;
        mutedForeground?: string;
        border?: string;
        input?: string;
        ring?: string;
        card?: string;
        cardForeground?: string;
        destructive?: string;
        destructiveForeground?: string;
      }>;
      typography?: Partial<{
        fontFamily?: string;
        fontFamilyHeading?: string;
        fontSizes?: Record<string, string>;
        fontWeights?: Record<string, number>;
        lineHeights?: Record<string, number>;
      }>;
      spacing?: Partial<Record<string, string>>;
      buttons?: Partial<{
        borderRadius?: "none" | "sm" | "md" | "lg" | "full";
        padding?: Record<string, string>;
        variants?: Record<string, Record<string, string>>;
      }>;
      layout?: Partial<{
        containerMaxWidth?: string;
        headerHeight?: string;
        footerHeight?: string;
        sidebarWidth?: string;
        cartDrawerWidth?: string;
      }>;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("themes_store_id_idx").on(table.storeId),
    themeIdIdx: index("themes_theme_id_idx").on(table.themeId),
    isActiveIdx: index("themes_is_active_idx").on(table.isActive),
    storeThemeIdx: index("themes_store_theme_idx").on(
      table.storeId,
      table.themeId,
    ),
  }),
);

export const themesRelations = relations(themes, ({ one }) => ({
  store: one(stores, {
    fields: [themes.storeId],
    references: [stores.id],
  }),
}));

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
