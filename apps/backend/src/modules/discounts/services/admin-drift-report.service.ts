import { Inject, Injectable } from "@nestjs/common";
import { and, desc, discountAuditLogs, eq, gte, lte } from "@vcecom/db";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { AuditEventType, DriftSeverity } from "../audit/discount-audit.types";

export interface DriftReportQuery {
  cartId?: string;
  checkoutId?: string;
  orderId?: string;
  paymentIntentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  severity?: DriftSeverity;
  page?: number;
  limit?: number;
}

export interface DriftReportEntry {
  id: string;
  timestamp: Date;
  event: AuditEventType;
  severity: DriftSeverity;
  cartId?: string;
  checkoutId?: string;
  orderId?: string;
  paymentIntentId?: string;
  // biome-ignore lint/suspicious/noExplicitAny: Flexible structure for drift details
  driftDetails?: any;
  // biome-ignore lint/suspicious/noExplicitAny: Flexible metadata structure
  metadata?: any;
}

@Injectable()
export class AdminDriftReportService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get drift report with filtering
   */
  async getDriftReport(query: DriftReportQuery): Promise<{
    data: DriftReportEntry[];
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
      eq(discountAuditLogs.event, AuditEventType.DRIFT_DETECTED),
    ];

    if (query.cartId) {
      conditions.push(eq(discountAuditLogs.cartId, query.cartId));
    }
    if (query.checkoutId) {
      conditions.push(eq(discountAuditLogs.checkoutId, query.checkoutId));
    }
    if (query.orderId) {
      conditions.push(eq(discountAuditLogs.orderId, query.orderId));
    }
    if (query.paymentIntentId) {
      conditions.push(
        eq(discountAuditLogs.paymentIntentId, query.paymentIntentId),
      );
    }
    if (query.dateFrom) {
      conditions.push(gte(discountAuditLogs.timestamp, query.dateFrom));
    }
    if (query.dateTo) {
      conditions.push(lte(discountAuditLogs.timestamp, query.dateTo));
    }
    if (query.severity) {
      conditions.push(eq(discountAuditLogs.severity, query.severity));
    }

    const logs = await this.db
      .select()
      .from(discountAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(discountAuditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const totalResult = await this.db
      .select()
      .from(discountAuditLogs)
      .where(and(...conditions));

    const total = totalResult.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        event: log.event as AuditEventType,
        severity: log.severity as DriftSeverity,
        cartId: log.cartId || undefined,
        checkoutId: log.checkoutId || undefined,
        orderId: log.orderId || undefined,
        paymentIntentId: log.paymentIntentId || undefined,
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
