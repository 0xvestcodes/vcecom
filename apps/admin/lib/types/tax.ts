/**
 * Tax-related TypeScript types
 * Mapped from backend DTOs
 */

export type TaxRuleType =
  | "CUSTOMER_GROUP"
  | "CUSTOMER"
  | "CATEGORY"
  | "PRODUCT"
  | "VARIANT";

export type TaxExemptionType =
  | "CUSTOMER_GROUP"
  | "CUSTOMER"
  | "CATEGORY"
  | "PRODUCT"
  | "VARIANT";

export type TaxDisplayType = "INCLUSIVE" | "EXCLUSIVE";

export interface TaxRule {
  id: string;
  name: string;
  description: string | null;
  ruleType: TaxRuleType;
  entityId: string;
  gstRate: number;
  priority: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxExemption {
  id: string;
  name: string;
  description: string | null;
  exemptionType: TaxExemptionType;
  entityId: string;
  exemptionReason: string | null;
  certificateNumber: string | null;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HsnCode {
  id: string;
  hsnCode: string;
  description: string | null;
  gstRate: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxAuditLog {
  id: string;
  timestamp: Date;
  event: string;
  severity: string;
  orderId: string | null;
  cartId: string | null;
  customerId: string | null;
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
  resolvedGstRate: number | null;
  baseAmount: number | null;
  taxAmount: number | null;
  calculationDetails?: {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
  };
  metadata?: Record<string, unknown>;
}
