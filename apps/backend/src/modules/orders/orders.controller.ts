import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  NotFoundErrorDto,
  TooManyRequestsErrorDto,
  UnauthorizedErrorDto,
} from "../../common/dto/error-response.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { DuplicateOrderDto } from "./dto/duplicate-order.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
import { OrderTimelineDto } from "./dto/order-timeline.dto";
import { OrderTrackingDto } from "./dto/order-tracking.dto";
import { PaymentIntentResponseDto } from "./dto/payment-intent-response.dto";
import {
  OrderStatus,
  UpdateOrderStatusDto,
} from "./dto/update-order-status.dto";
import { OrdersService } from "./orders.service";
import { ReconciliationService } from "./reconciliation.service";
import { OrderArchiveService } from "./services/operations/order-archive.service";
import { OrderCancelService } from "./services/operations/order-cancel.service";
import { OrderDuplicateService } from "./services/operations/order-duplicate.service";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@ApiTags("store")
@Controller("store/orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    readonly _reconciliationService: ReconciliationService,
    private readonly cancelService: OrderCancelService,
    private readonly archiveService: OrderArchiveService,
    private readonly duplicateService: OrderDuplicateService,
  ) {}

  @Post()
  @Public()
  @RateLimit(RATE_LIMIT_PRESETS.PAYMENT_INTENT)
  @ApiOperation({
    summary: "Create payment intent for checkout",
    description:
      "Creates a payment intent for checkout. Supports both authenticated and guest checkout. Orders are created only after payment confirmation via webhook. Returns payment intent and checkout session ID for redirecting to payment gateway.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest checkout (required for guest checkout)",
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: "Payment intent created successfully",
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (empty cart, insufficient inventory, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized (for authenticated checkout)",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Addresses not found or do not belong to customer",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 409,
    description:
      "Conflict (cart already being checked out, invalid state, etc.)",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async create(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Body() createOrderDto: CreateOrderDto,
    @Headers("x-session-id") sessionId?: string,
  ): Promise<PaymentIntentResponseDto> {
    const userId = req.user?.userId || null;
    return this.ordersService.create(userId, createOrderDto, sessionId || null);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get all orders for authenticated customer with enriched data",
    description:
      "Returns all orders for the authenticated customer with enriched product data, " +
      "addresses, and payment details. Optionally filter by status.",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: OrderStatus,
    description: "Filter orders by status",
    example: "pending",
  })
  @ApiResponse({
    status: 200,
    description: "List of orders",
    type: [OrderResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query("status") status?: OrderStatus,
  ) {
    return this.ordersService.findAll(req.user.userId, status);
  }

  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "Get order by ID with enriched product data",
    description:
      "Returns a specific order by ID with complete product details (titles, images, SKUs), " +
      "embedded addresses, payment details, shipping information, and pricing snapshots. " +
      "Supports both authenticated customers and guest orders. No additional API calls needed for display.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Order details",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async findOne(
    @Request() req: Request & {
      user?: { userId: string; email: string; role: string };
    },
    @Param("id") id: string,
  ) {
    // If user is authenticated, use authenticated flow
    if (req.user?.userId) {
      return this.ordersService.findOne(req.user.userId, id);
    }
    // Otherwise, use public guest order lookup
    return this.ordersService.findOnePublic(id);
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update order status",
    description:
      "Updates the status of an order. Validates status transitions according to order workflow.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Order status updated successfully",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid status transition",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Invalid status transition",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 422,
    description: "Unprocessable entity - Invalid status transition",
    type: BadRequestErrorDto,
  })
  async updateStatus(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(
      req.user.userId,
      id,
      updateStatusDto,
    );
  }

  @Get(":id/tracking")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get order tracking information",
    description:
      "Returns tracking information for an order including shipment details and tracking numbers.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Order tracking information",
    type: OrderTrackingDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async getTracking(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.ordersService.getTracking(req.user.userId, id);
  }

  @Get(":id/timeline")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get order timeline",
    description:
      "Returns a chronological timeline of all events related to the order including status changes, payments, and shipments.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Order timeline",
    type: OrderTimelineDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async getTimeline(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.ordersService.getTimeline(req.user.userId, id);
  }

  @Post(":id/payment-retry")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @RateLimit(RATE_LIMIT_PRESETS.PAYMENT_INTENT)
  @ApiOperation({
    summary: "Retry payment for an order",
    description:
      "Creates a new payment intent for an order that failed payment. Returns payment intent ID and redirect URL.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 201,
    description: "Payment intent created successfully",
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (order already paid, invalid state, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Order already has active payment intent",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async retryPayment(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<PaymentIntentResponseDto> {
    // This will need to be implemented in OrdersService
    // For now, return a placeholder
    throw new Error("Payment retry not yet implemented");
  }

  @Post(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Cancel order",
    description:
      "Cancels an order. Customers can only cancel orders in pending, confirmed, or processing status. Inventory will be released back to available stock.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Order cancelled successfully",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (order cannot be cancelled, invalid status, etc.)",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Order cannot be cancelled in current state",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async cancelOrder(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() cancelDto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    return this.cancelService.cancelOrder(req.user.userId, id, cancelDto);
  }

  @Post(":id/archive")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Archive order",
    description:
      "Archives an order. Archived orders are hidden from default order lists but can be accessed with filters.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Order archived successfully",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (order already archived, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async archiveOrder(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<OrderResponseDto> {
    return this.archiveService.archiveOrder(req.user.userId, id);
  }

  @Post(":id/unarchive")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Unarchive order",
    description:
      "Unarchives an order, making it visible in default order lists again.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Order unarchived successfully",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (order not archived, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async unarchiveOrder(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<OrderResponseDto> {
    return this.archiveService.unarchiveOrder(req.user.userId, id);
  }

  @Post(":id/duplicate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Duplicate order",
    description:
      "Creates a new order based on an existing order with the same items. New order will have status 'pending' and can be checked out normally.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID to duplicate",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 201,
    description: "Order duplicated successfully",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (insufficient inventory, invalid addresses, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async duplicateOrder(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() duplicateDto: DuplicateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.duplicateService.duplicateOrder(
      req.user.userId,
      id,
      duplicateDto,
    );
  }
}
