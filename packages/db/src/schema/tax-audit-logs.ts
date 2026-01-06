import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Tax audit event types
 */
export const taxAuditEventTypeEnum = pgEnum("tax_audit_event_type", [
  "CALCULATION",
  "OVERRIDE_APPLIED",
  "EXEMPTION_APPLIED",
  "RATE_RESOLVED",
  "TAX_ENGINE_RUN",
  "TAX_SNAPSHOT_CREATED",
  "TAX_SNAPSHOT_USED",
  "TAX_RULE_CHANGE",
  "TAX_EXEMPTION_CHANGE",
  "ORDER_TAX_FINALIZED",
  "DRIFT_DETECTED",
]);

/**
 * Tax audit log severity levels
 */
export const taxAuditSeverityEnum = pgEnum("tax_audit_severity", [
  "INFO",
  "WARNING",
  "CRITICAL",
]);

/**
 * Tax audit logs table
 * Stores immutable audit trail of all tax-related operations
 */
export const taxAuditLogs = pgTable(
  "tax_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    event: taxAuditEventTypeEnum("event").notNull(),
    severity: taxAuditSeverityEnum("severity").notNull().default("INFO"),

    // Context identifiers
    cartId: uuid("cart_id"),
    checkoutId: uuid("checkout_id"),
    orderId: uuid("order_id"),
    customerId: uuid("customer_id"),
    productId: uuid("product_id"),
    variantId: uuid("variant_id"),

    // Tax rule and exemption information
    appliedTaxRules: jsonb("applied_tax_rules"), // JSON array of applied tax rule IDs with details
    appliedExemptions: jsonb("applied_exemptions"), // JSON array of applied exemption IDs with details

    // Resolved tax information
    resolvedGstRate: real("resolved_gst_rate"), // Final GST rate applied
    baseAmount: real("base_amount"), // Amount before tax
    taxAmount: real("tax_amount"), // Total tax amount

    // Calculation breakdown
    calculationDetails: jsonb("calculation_details"), // JSON object with CGST, SGST, IGST breakdown

    // Snapshot metadata (for order tax snapshots)
    snapshotVersion: text("snapshot_version"),
    ruleHash: text("rule_hash"),
    engineVersion: text("engine_version"),

    // Drift detection details
    driftDetails: jsonb("drift_details"), // JSON object with drift information

    // Additional metadata
    metadata: jsonb("metadata"), // JSON object for flexible metadata storage
  },
  (table) => ({
    timestampIdx: index("tax_audit_logs_timestamp_idx").on(table.timestamp),
    eventIdx: index("tax_audit_logs_event_idx").on(table.event),
    severityIdx: index("tax_audit_logs_severity_idx").on(table.severity),
    cartIdIdx: index("tax_audit_logs_cart_id_idx").on(table.cartId),
    checkoutIdIdx: index("tax_audit_logs_checkout_id_idx").on(table.checkoutId),
    orderIdIdx: index("tax_audit_logs_order_id_idx").on(table.orderId),
    customerIdIdx: index("tax_audit_logs_customer_id_idx").on(table.customerId),
    productIdIdx: index("tax_audit_logs_product_id_idx").on(table.productId),
    variantIdIdx: index("tax_audit_logs_variant_id_idx").on(table.variantId),
    ruleHashIdx: index("tax_audit_logs_rule_hash_idx").on(table.ruleHash),
  }),
);

export const taxAuditLogsRelations = relations(taxAuditLogs, () => ({}));

export type TaxAuditLog = typeof taxAuditLogs.$inferSelect;
export type NewTaxAuditLog = typeof taxAuditLogs.$inferInsert;
