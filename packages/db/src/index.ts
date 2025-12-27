// Export all schemas

// Re-export commonly used Drizzle ORM helper functions
// These are used throughout the codebase for query building
export {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  not,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
export * from "./schema/index";
// Re-export schema for convenience
export * as schema from "./schema/index";
// Export types
export type * from "./types";

// Note: Database connection and pool management has been moved to apps/backend/src/modules/database/db.ts
// This package now only exports schemas, types, and Drizzle helper functions for type sharing across the monorepo
