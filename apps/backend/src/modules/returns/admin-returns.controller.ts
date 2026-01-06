import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  and,
  eq,
  returnEligibilityRules,
  returnRequestStatusEnum,
  returnRequests,
} from "@vcecom/db";
import { SQL } from "drizzle-orm";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { RefundReconciliationService } from "./services/refund-reconciliation.service";
import { ReturnEligibilityService } from "./services/return-eligibility.service";
import { ReturnManagementService } from "./services/return-management.service";
import { ReturnRequestService } from "./services/return-request.service";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

export class ApproveReturnDto {
  returnAddressId?: string;
  notes?: string;
}

export class RejectReturnDto {
  reason: string;
}

export class UpdateReturnStatusDto {
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "in_transit"
    | "received"
    | "processing_refund"
    | "completed"
    | "cancelled";
  trackingNumber?: string;
  notes?: string;
}

export class CreateEligibilityRuleDto {
  name: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  conditions: Record<string, unknown>;
  maxDaysAfterDelivery?: number;
  allowedReasons?: string[];
  excludedCategories?: string[];
  excludedProducts?: string[];
  minOrderValue?: number;
  maxReturnsPerCustomer?: number;
}

export class UpdateEligibilityRuleDto {
  name?: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  conditions?: Record<string, unknown>;
  maxDaysAfterDelivery?: number;
  allowedReasons?: string[];
  excludedCategories?: string[];
  excludedProducts?: string[];
  minOrderValue?: number;
  maxReturnsPerCustomer?: number;
}

@ApiTags("admin")
@Controller("admin/returns")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminReturnsController {
  constructor(
    private readonly returnRequestService: ReturnRequestService,
    private readonly returnManagementService: ReturnManagementService,
    readonly _eligibilityService: ReturnEligibilityService,
    private readonly reconciliationService: RefundReconciliationService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "List all return requests (admin)",
    description: "Get paginated list of return requests with filters",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: [
      "pending",
      "approved",
      "rejected",
      "in_transit",
      "received",
      "processing_refund",
      "completed",
      "cancelled",
    ],
  })
  @ApiQuery({
    name: "orderId",
    required: false,
    type: String,
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Return requests retrieved successfully",
  })
  async listReturns(
    @Query() query: { status?: string; orderId?: string; customerId?: string },
  ) {
    const conditions: SQL[] = [];
    if (query.status) {
      conditions.push(
        eq(
          returnRequests.status,
          query.status as (typeof returnRequestStatusEnum.enumValues)[number],
        ),
      );
    }
    if (query.orderId) {
      conditions.push(eq(returnRequests.orderId, query.orderId));
    }
    if (query.customerId) {
      conditions.push(eq(returnRequests.customerId, query.customerId));
    }

    const returns = await this.db
      .select()
      .from(returnRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Promise.all(
      returns.map((r) => this.returnRequestService.findOne(r.id)),
    );
  }

  @Get(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get return request details (admin)",
  })
  @ApiParam({
    name: "id",
    description: "Return request ID",
  })
  @ApiResponse({
    status: 200,
    description: "Return request retrieved successfully",
  })
  async getReturnRequest(@Param("id") id: string) {
    const returnRequest = await this.returnRequestService.findOne(id);
    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }
    return returnRequest;
  }

  @Post(":id/approve")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Approve return request (admin)",
  })
  @ApiParam({
    name: "id",
    description: "Return request ID",
  })
  @ApiResponse({
    status: 200,
    description: "Return request approved",
  })
  async approveReturn(
    @Param("id") id: string,
    @Body() dto: ApproveReturnDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.returnManagementService.approveReturn(id, req.user.userId, dto);
  }

  @Post(":id/reject")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Reject return request (admin)",
  })
  @ApiParam({
    name: "id",
    description: "Return request ID",
  })
  @ApiResponse({
    status: 200,
    description: "Return request rejected",
  })
  async rejectReturn(
    @Param("id") id: string,
    @Body() dto: RejectReturnDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.returnManagementService.rejectReturn(id, req.user.userId, dto);
  }

  @Patch(":id/status")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update return request status (admin)",
  })
  @ApiParam({
    name: "id",
    description: "Return request ID",
  })
  @ApiResponse({
    status: 200,
    description: "Return request status updated",
  })
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateReturnStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.returnManagementService.updateStatus(id, req.user.userId, dto);
  }

  @Post(":id/process-refund")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Process refund for return request (admin)",
  })
  @ApiParam({
    name: "id",
    description: "Return request ID",
  })
  @ApiResponse({
    status: 200,
    description: "Refund processing initiated",
  })
  async processRefund(@Param("id") id: string) {
    // This will be handled by the return management service when status is updated to processing_refund
    const returnRequest = await this.returnRequestService.findOne(id);
    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }
    return this.returnManagementService.updateStatus(
      id,
      "system", // System-initiated
      { status: "processing_refund" } as UpdateReturnStatusDto,
    );
  }

  @Get(":id/reconciliation")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get refund reconciliation status (admin)",
  })
  @ApiParam({
    name: "id",
    description: "Return request ID",
  })
  @ApiResponse({
    status: 200,
    description: "Reconciliation status retrieved",
  })
  async getReconciliation(@Param("id") returnRequestId: string) {
    // Get refund ID from return request
    const returnRequest =
      await this.returnRequestService.findOne(returnRequestId);
    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }

    // Get refunds for the order
    const { refunds } = await import("@vcecom/db");
    const orderRefunds = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, returnRequest.orderId));

    if (orderRefunds.length === 0) {
      return { reconciliation: null };
    }

    // Get reconciliation for the most recent refund
    const latestRefund = orderRefunds[orderRefunds.length - 1];
    const reconciliation = await this.reconciliationService.getByRefundId(
      latestRefund.id,
    );

    return { reconciliation };
  }

  @Get("eligibility-rules")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "List return eligibility rules (admin)",
  })
  @ApiResponse({
    status: 200,
    description: "Eligibility rules retrieved",
  })
  async listEligibilityRules() {
    return this.db.select().from(returnEligibilityRules);
  }

  @Post("eligibility-rules")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Create return eligibility rule (admin)",
  })
  @ApiResponse({
    status: 201,
    description: "Eligibility rule created",
  })
  async createEligibilityRule(@Body() dto: CreateEligibilityRuleDto) {
    const [rule] = await this.db
      .insert(returnEligibilityRules)
      .values({
        name: dto.name,
        description: dto.description || null,
        enabled: dto.enabled ?? true,
        priority: dto.priority ?? 0,
        conditions: dto.conditions,
        maxDaysAfterDelivery: dto.maxDaysAfterDelivery || null,
        allowedReasons: dto.allowedReasons || null,
        excludedCategories: dto.excludedCategories || null,
        excludedProducts: dto.excludedProducts || null,
        minOrderValue: dto.minOrderValue || null,
        maxReturnsPerCustomer: dto.maxReturnsPerCustomer || null,
      })
      .returning();

    return rule;
  }

  @Patch("eligibility-rules/:id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update return eligibility rule (admin)",
  })
  @ApiParam({
    name: "id",
    description: "Rule ID",
  })
  @ApiResponse({
    status: 200,
    description: "Eligibility rule updated",
  })
  async updateEligibilityRule(
    @Param("id") id: string,
    @Body() dto: UpdateEligibilityRuleDto,
  ) {
    const updateData: Partial<typeof returnEligibilityRules.$inferInsert> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.enabled !== undefined) updateData.enabled = dto.enabled;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.conditions !== undefined) updateData.conditions = dto.conditions;
    if (dto.maxDaysAfterDelivery !== undefined)
      updateData.maxDaysAfterDelivery = dto.maxDaysAfterDelivery;
    if (dto.allowedReasons !== undefined)
      updateData.allowedReasons = dto.allowedReasons;
    if (dto.excludedCategories !== undefined)
      updateData.excludedCategories = dto.excludedCategories;
    if (dto.excludedProducts !== undefined)
      updateData.excludedProducts = dto.excludedProducts;
    if (dto.minOrderValue !== undefined)
      updateData.minOrderValue = dto.minOrderValue;
    if (dto.maxReturnsPerCustomer !== undefined)
      updateData.maxReturnsPerCustomer = dto.maxReturnsPerCustomer;

    const [updated] = await this.db
      .update(returnEligibilityRules)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(returnEligibilityRules.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException("Eligibility rule not found");
    }

    return updated;
  }
}
