/**
 * Tax audit event types
 */
export enum TaxAuditEventType {
  CALCULATION = "CALCULATION",
  OVERRIDE_APPLIED = "OVERRIDE_APPLIED",
  EXEMPTION_APPLIED = "EXEMPTION_APPLIED",
  RATE_RESOLVED = "RATE_RESOLVED",
  TAX_ENGINE_RUN = "TAX_ENGINE_RUN",
  TAX_SNAPSHOT_CREATED = "TAX_SNAPSHOT_CREATED",
  TAX_SNAPSHOT_USED = "TAX_SNAPSHOT_USED",
  TAX_RULE_CHANGE = "TAX_RULE_CHANGE",
  TAX_EXEMPTION_CHANGE = "TAX_EXEMPTION_CHANGE",
  ORDER_TAX_FINALIZED = "ORDER_TAX_FINALIZED",
  DRIFT_DETECTED = "DRIFT_DETECTED",
}

/**
 * Tax audit severity levels
 */
export enum TaxAuditSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
}

/**
 * Tax audit log entry interface
 */
export interface TaxAuditLogEntry {
  event: TaxAuditEventType;
  cartId?: string;
  checkoutId?: string;
  orderId?: string;
  customerId?: string;
  productId?: string;
  variantId?: string;
  appliedTaxRules?: Array<{
    ruleId: string;
    ruleName: string;
    ruleType: string;
    gstRate: number;
  }>;
  appliedExemptions?: Array<{
    exemptionId: string;
    exemptionName: string;
    exemptionType: string;
  }>;
  resolvedGstRate?: number;
  baseAmount?: number;
  taxAmount?: number;
  calculationDetails?: {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
  };
  snapshotVersion?: string;
  ruleHash?: string;
  engineVersion?: string;
  // biome-ignore lint/suspicious/noExplicitAny: Flexible structure for drift details
  driftDetails?: any;
  severity?: TaxAuditSeverity;
  // biome-ignore lint/suspicious/noExplicitAny: Flexible metadata structure for audit logs
  metadata?: Record<string, any>;
}
