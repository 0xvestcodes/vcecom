import {
  boolean,
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
 * Import template type enum
 */
export const importTemplateTypeEnum = pgEnum("import_template_type", [
  "products",
  "categories",
  "inventory",
  "customers",
]);

/**
 * Import templates table
 * Stores template definitions and metadata for import operations
 */
export const importTemplates = pgTable(
  "import_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: importTemplateTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    columns:
      jsonb("columns").$type<
        Array<{
          name: string;
          label: string;
          required: boolean;
          type: string;
          validation?: {
            min?: number;
            max?: number;
            pattern?: string;
            enum?: string[];
            [key: string]: unknown;
          };
          description?: string;
        }>
      >(),
    sampleData: jsonb("sample_data").$type<Array<Record<string, unknown>>>(),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("import_templates_type_idx").on(table.type),
    isActiveIdx: index("import_templates_is_active_idx").on(table.isActive),
    typeVersionIdx: index("import_templates_type_version_idx").on(
      table.type,
      table.version,
    ),
  }),
);

export type ImportTemplate = typeof importTemplates.$inferSelect;
export type NewImportTemplate = typeof importTemplates.$inferInsert;
