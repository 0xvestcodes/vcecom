import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { importJobs } from "./import-jobs";

/**
 * Import job errors table
 * Stores detailed error logs per row/item in import jobs
 */
export const importJobErrors = pgTable(
  "import_job_errors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importJobId: uuid("import_job_id")
      .notNull()
      .references(() => importJobs.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    field: text("field"), // Field name that caused error
    value: text("value"), // Invalid value
    errorCode: text("error_code").notNull(), // Error code for categorization
    errorMessage: text("error_message").notNull(), // Human-readable error message
    rawData: jsonb("raw_data"), // Full row data for debugging
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    importJobIdIdx: index("import_job_errors_import_job_id_idx").on(
      table.importJobId,
    ),
    rowNumberIdx: index("import_job_errors_row_number_idx").on(table.rowNumber),
    errorCodeIdx: index("import_job_errors_error_code_idx").on(table.errorCode),
    createdAtIdx: index("import_job_errors_created_at_idx").on(table.createdAt),
  }),
);

export const importJobErrorsRelations = relations(
  importJobErrors,
  ({ one }) => ({
    importJob: one(importJobs, {
      fields: [importJobErrors.importJobId],
      references: [importJobs.id],
    }),
  }),
);

export type ImportJobError = typeof importJobErrors.$inferSelect;
export type NewImportJobError = typeof importJobErrors.$inferInsert;
