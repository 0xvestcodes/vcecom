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
import { users } from "./users";

/**
 * Import job type enum
 */
export const importJobTypeEnum = pgEnum("import_job_type", [
  "products",
  "categories",
  "inventory",
  "customers",
]);

/**
 * Import job source enum
 */
export const importJobSourceEnum = pgEnum("import_job_source", [
  "csv",
  "excel",
  "json",
  "shopify",
  "api",
]);

/**
 * Import job status enum
 */
export const importJobStatusEnum = pgEnum("import_job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

/**
 * Import jobs table
 * Tracks import job status, progress, and metadata
 */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: importJobTypeEnum("type").notNull(),
    source: importJobSourceEnum("source").notNull(),
    status: importJobStatusEnum("status").notNull().default("pending"),
    fileUrl: text("file_url"), // Storage URL of uploaded file
    totalRows: integer("total_rows").default(0),
    processedRows: integer("processed_rows").default(0),
    successfulRows: integer("successful_rows").default(0),
    failedRows: integer("failed_rows").default(0),
    metadata: jsonb("metadata").$type<{
      fileName?: string;
      fileSize?: number;
      options?: {
        skipErrors?: boolean;
        updateExisting?: boolean;
        dryRun?: boolean;
        [key: string]: unknown;
      };
      shopifyConfig?: {
        shopDomain?: string;
        lastSyncAt?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }>(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    typeIdx: index("import_jobs_type_idx").on(table.type),
    statusIdx: index("import_jobs_status_idx").on(table.status),
    sourceIdx: index("import_jobs_source_idx").on(table.source),
    createdByIdx: index("import_jobs_created_by_idx").on(table.createdBy),
    createdAtIdx: index("import_jobs_created_at_idx").on(table.createdAt),
  }),
);

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  creator: one(users, {
    fields: [importJobs.createdBy],
    references: [users.id],
  }),
}));

export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;
