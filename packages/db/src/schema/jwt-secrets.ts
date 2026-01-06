import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * JWT Secrets table
 * Stores multiple versions of JWT secrets for rotation support
 */
export const jwtSecrets = pgTable(
  "jwt_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    secret: text("secret").notNull(), // Encrypted secret
    version: text("version").notNull().unique(), // Version identifier (e.g., "v1", "v2")
    isActive: boolean("is_active").notNull().default(true), // Currently active for signing
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(), // When this secret expires
    rotatedAt: timestamp("rotated_at"), // When this secret was rotated out
  },
  (table) => ({
    versionIdx: index("idx_jwt_secrets_version").on(table.version),
    isActiveIdx: index("idx_jwt_secrets_isActive").on(table.isActive),
    expiresAtIdx: index("idx_jwt_secrets_expiresAt").on(table.expiresAt),
  }),
);

export type JwtSecret = typeof jwtSecrets.$inferSelect;
export type NewJwtSecret = typeof jwtSecrets.$inferInsert;
