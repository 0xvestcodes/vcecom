import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, lte, pricingAuditLogs } from "@vcecom/db";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  PricingAuditEventType,
  PricingDriftSeverity,
} from "../audit/pricing-audit.types";

export interface PricingDriftReportQuery {
  variantId?: string;
  orderId?: string;
  checkoutId?: string;
  priceListId?: string;
  customerGroupId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  severity?: PricingDriftSeverity;
  page?: number;
  limit?: number;
}

export interface PricingDriftReportEntry {
  id: string;
  timestamp: Date;
  event: PricingAuditEventType;
  severity: PricingDriftSeverity;
  variantId?: string;
  orderId?: string;
  checkoutId?: string;
  priceListId?: string;
  customerGroupId?: string;
  // biome-ignore lint/suspicious/noExplicitAny: Flexible structure for drift details
  driftDetails?: any;
  // biome-ignore lint/suspicious/noExplicitAny: Flexible metadata structure
  metadata?: any;
}

@Injectable()
export class AdminPricingDriftReportService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get pricing drift report with filtering
   */
  async getDriftReport(query: PricingDriftReportQuery): Promise<{
    data: PricingDriftReportEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    // biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM condition array type
    const conditions: any[] = [
      eq(pricingAuditLogs.event, PricingAuditEventType.PRICING_DRIFT_DETECTED),
    ];

    if (query.variantId) {
      conditions.push(eq(pricingAuditLogs.variantId, query.variantId));
    }
    if (query.checkoutId) {
      conditions.push(eq(pricingAuditLogs.checkoutId, query.checkoutId));
    }
    if (query.orderId) {
      conditions.push(eq(pricingAuditLogs.orderId, query.orderId));
    }
    if (query.priceListId) {
      conditions.push(eq(pricingAuditLogs.priceListId, query.priceListId));
    }
    if (query.customerGroupId) {
      conditions.push(
        eq(pricingAuditLogs.customerGroupId, query.customerGroupId),
      );
    }
    if (query.dateFrom) {
      conditions.push(gte(pricingAuditLogs.timestamp, query.dateFrom));
    }
    if (query.dateTo) {
      conditions.push(lte(pricingAuditLogs.timestamp, query.dateTo));
    }
    if (query.severity) {
      conditions.push(eq(pricingAuditLogs.severity, query.severity));
    }

    const logs = await this.db
      .select()
      .from(pricingAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(pricingAuditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const totalResult = await this.db
      .select()
      .from(pricingAuditLogs)
      .where(and(...conditions));

    const total = totalResult.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        event: log.event as PricingAuditEventType,
        severity: log.severity as PricingDriftSeverity,
        variantId: log.variantId || undefined,
        orderId: log.orderId || undefined,
        checkoutId: log.checkoutId || undefined,
        priceListId: log.priceListId || undefined,
        customerGroupId: log.customerGroupId || undefined,
        driftDetails: log.driftDetails,
        metadata: log.metadata,
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }
}
