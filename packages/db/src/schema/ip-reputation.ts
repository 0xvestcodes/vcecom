import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * IP Reputation table
 * Caches IP reputation scores and analysis results
 */
export const ipReputation = pgTable(
  "ip_reputation",
  {
    ipAddress: text("ip_address").primaryKey(),
    reputationScore: text("reputation_score").notNull(), // 0-100, higher = more suspicious
    isDatacenter: boolean("is_datacenter").notNull().default(false),
    isVpn: boolean("is_vpn").notNull().default(false),
    isProxy: boolean("is_proxy").notNull().default(false),
    isTor: boolean("is_tor").notNull().default(false),
    country: text("country"),
    city: text("city"),
    asn: text("asn"), // Autonomous System Number
    organization: text("organization"),
    riskFactors: jsonb("risk_factors"), // Array of risk factors detected
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    reputationScoreIdx: index("idx_ip_reputation_reputationScore").on(
      table.reputationScore,
    ),
    lastSeenAtIdx: index("idx_ip_reputation_lastSeenAt").on(table.lastSeenAt),
  }),
);

export type IpReputation = typeof ipReputation.$inferSelect;
export type NewIpReputation = typeof ipReputation.$inferInsert;
