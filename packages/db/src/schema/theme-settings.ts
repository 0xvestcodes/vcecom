import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const themeSettings = pgTable(
  "theme_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .references(() => stores.id, { onDelete: "cascade" })
      .unique(),

    // V1: Core colors only (OKLCH format)
    colors: jsonb("colors")
      .$type<{
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        foreground: string;
      }>()
      .notNull(),

    // V1: Single spacing value for sections
    sectionPadding: text("section_padding").default("md").notNull(), // "xs" | "sm" | "md" | "lg" | "xl"

    // V1: Single global radius
    globalRadius: text("global_radius").default("md").notNull(), // "none" | "sm" | "md" | "lg" | "full"

    // V1: Font families only
    typography: jsonb("typography")
      .$type<{
        fontSans: string; // "Inter, sans-serif"
        fontSerif: string; // "Source Serif 4, serif"
      }>()
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("theme_settings_store_id_idx").on(table.storeId),
  }),
);

export type ThemeSettings = typeof themeSettings.$inferSelect;
export type NewThemeSettings = typeof themeSettings.$inferInsert;
