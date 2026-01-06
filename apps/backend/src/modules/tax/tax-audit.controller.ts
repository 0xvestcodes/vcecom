import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { and, eq, taxAuditEventTypeEnum, taxAuditLogs } from "@vcecom/db";
import { SQL } from "drizzle-orm";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import {
  QueryTaxAuditLogsDto,
  TaxAuditLogResponseDto,
} from "./dto/tax-audit.dto";

@ApiTags("admin")
@Controller("admin/tax-audit")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class TaxAuditController {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  @Get()
  @ApiOperation({ summary: "Query tax audit logs (admin)" })
  @ApiQuery({ name: "orderId", required: false, type: String })
  @ApiQuery({ name: "cartId", required: false, type: String })
  @ApiQuery({ name: "customerId", required: false, type: String })
  @ApiQuery({ name: "event", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Tax audit logs retrieved successfully",
    type: [TaxAuditLogResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async queryAuditLogs(
    @Query() query: QueryTaxAuditLogsDto,
  ): Promise<TaxAuditLogResponseDto[]> {
    const conditions: SQL[] = [];

    if (query.orderId) {
      conditions.push(eq(taxAuditLogs.orderId, query.orderId));
    }
    if (query.cartId) {
      conditions.push(eq(taxAuditLogs.cartId, query.cartId));
    }
    if (query.customerId) {
      conditions.push(eq(taxAuditLogs.customerId, query.customerId));
    }
    if (query.event) {
      conditions.push(
        eq(
          taxAuditLogs.event,
          query.event as (typeof taxAuditEventTypeEnum.enumValues)[number],
        ),
      );
    }

    const logs = await this.db
      .select()
      .from(taxAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(taxAuditLogs.timestamp);

    return logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      event: log.event,
      severity: log.severity,
      orderId: log.orderId,
      cartId: log.cartId,
      customerId: log.customerId,
      appliedTaxRules: log.appliedTaxRules as
        | Array<{
            ruleId: string;
            ruleName: string;
            ruleType: string;
            gstRate: number;
          }>
        | undefined,
      appliedExemptions: log.appliedExemptions as
        | Array<{
            exemptionId: string;
            exemptionName: string;
            exemptionType: string;
          }>
        | undefined,
      resolvedGstRate: log.resolvedGstRate ? Number(log.resolvedGstRate) : null,
      baseAmount: log.baseAmount ? Number(log.baseAmount) : null,
      taxAmount: log.taxAmount ? Number(log.taxAmount) : null,
      calculationDetails: log.calculationDetails as
        | {
            cgst: number;
            sgst: number;
            igst: number;
            totalGst: number;
          }
        | undefined,
      metadata: log.metadata as Record<string, unknown> | undefined,
    }));
  }
}
