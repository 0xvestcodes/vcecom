import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { and, eq, orders } from "@vcecom/db";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  BadRequestErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from "../../common/dto/error-response.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { OrderValidationService } from "../orders/services/validation/order-validation.service";
import { ReturnEligibilityService } from "./services/return-eligibility.service";
import { ReturnRequestService } from "./services/return-request.service";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

export class CreateReturnRequestDto {
  reason: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    reason: string;
    condition: "new" | "damaged" | "defective" | "other";
  }>;
}

@ApiTags("store")
@Controller("store/orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
@Roles("customer")
export class ReturnsController {
  constructor(
    private readonly returnRequestService: ReturnRequestService,
    private readonly eligibilityService: ReturnEligibilityService,
    private readonly validationService: OrderValidationService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  @Post(":orderId/returns")
  @RateLimit(RATE_LIMIT_PRESETS.CREATE)
  @ApiOperation({
    summary: "Create return request for an order",
    description:
      "Create a return request for a delivered order. Validates eligibility before creating the request.",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 201,
    description: "Return request created successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (not eligible, invalid items, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  async createReturnRequest(
    @Param("orderId") orderId: string,
    @Body() dto: CreateReturnRequestDto,
    @Request() req: AuthenticatedRequest,
  ) {
    // Get customer ID from user
    const customerId = await this.validationService.getCustomerId(
      req.user.userId,
    );

    // Verify order belongs to customer
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.returnRequestService.create({
      orderId,
      customerId,
      reason: dto.reason,
      items: dto.items,
    });
  }

  @Get(":orderId/returns")
  @RateLimit(RATE_LIMIT_PRESETS.GET)
  @ApiOperation({
    summary: "Get return requests for an order",
    description: "Get all return requests for a specific order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Return requests retrieved successfully",
  })
  async getReturnRequests(
    @Param("orderId") orderId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const customerId = await this.validationService.getCustomerId(
      req.user.userId,
    );

    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.returnRequestService.findByOrderId(orderId, customerId);
  }

  @Get("returns/:returnId")
  @RateLimit(RATE_LIMIT_PRESETS.GET)
  @ApiOperation({
    summary: "Get return request details",
    description: "Get details of a specific return request",
  })
  @ApiParam({
    name: "returnId",
    description: "Return request ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Return request retrieved successfully",
  })
  async getReturnRequest(
    @Param("returnId") returnId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const customerId = await this.validationService.getCustomerId(
      req.user.userId,
    );

    const returnRequest = await this.returnRequestService.findOne(
      returnId,
      customerId,
    );

    if (!returnRequest) {
      throw new NotFoundException("Return request not found");
    }

    return returnRequest;
  }

  @Get("returns/:returnId/eligibility")
  @RateLimit(RATE_LIMIT_PRESETS.GET)
  @ApiOperation({
    summary: "Check return eligibility",
    description: "Check if an order is eligible for return",
  })
  @ApiParam({
    name: "returnId",
    description: "Return request ID (or order ID)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Eligibility check completed",
  })
  async checkEligibility(
    @Param("returnId") orderId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const customerId = await this.validationService.getCustomerId(
      req.user.userId,
    );

    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.eligibilityService.checkEligibility({
      orderId,
      customerId,
      returnReason: "check", // Generic reason for eligibility check
    });
  }
}
