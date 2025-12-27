import {
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
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
import { addresses, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { calculateGstBreakdown } from "../../common/utils/gst.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { CreateOrderNoteDto } from "../admin/dto/create-order-note.dto";
import { CreateRefundDto } from "../admin/dto/create-refund.dto";
import { MarkOrderPaidResponseDto } from "../admin/dto/mark-order-paid.dto";
import { OrderNoteResponseDto } from "../admin/dto/order-note-response.dto";
import { RefundResponseDto } from "../admin/dto/refund-response.dto";
import { UpdateOrderAddressDto } from "../admin/dto/update-order-address.dto";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { DuplicateOrderDto } from "./dto/duplicate-order.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
import { OrderTimelineDto } from "./dto/order-timeline.dto";
import { OrderTrackingDto } from "./dto/order-tracking.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { ReconciliationService } from "./reconciliation.service";
import { OrderAddressService } from "./services/order-address.service";
import { OrderArchiveService } from "./services/order-archive.service";
import { OrderCancelService } from "./services/order-cancel.service";
import { OrderDuplicateService } from "./services/order-duplicate.service";
import { OrderNotesService } from "./services/order-notes.service";
import { OrderPaymentService } from "./services/order-payment.service";
import { OrderStatusService } from "./services/order-status.service";
import { OrderTimelineService } from "./services/order-timeline.service";
import { RefundsService } from "./services/refunds.service";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@ApiTags("admin")
@Controller("admin/orders")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminOrdersController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly orderNotesService: OrderNotesService,
    private readonly refundsService: RefundsService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly orderAddressService: OrderAddressService,
    private readonly timelineService: OrderTimelineService,
    private readonly statusService: OrderStatusService,
    private readonly cancelService: OrderCancelService,
    private readonly archiveService: OrderArchiveService,
    private readonly duplicateService: OrderDuplicateService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  @Get(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get order by ID (admin)",
    description: "Retrieve a single order by its ID (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Order retrieved successfully",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async findOne(@Param("id") id: string): Promise<OrderResponseDto> {
    try {
      let order: typeof orders.$inferSelect | undefined;
      try {
        const orderResult = await this.db
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        order = orderResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "AdminOrdersController.findOne.selectOrder",
            error,
            { orderId: id },
          ),
          "Failed to fetch order",
        );
        throw new NotFoundException("Order not found");
      }

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Get order items with GST rates
      let items: Array<{
        id: string;
        orderId: string;
        productVariantId: string;
        quantity: number;
        price: number;
        gstRate: number;
        gstAmount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      try {
        items = await this.db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productVariantId: orderItems.productVariantId,
            quantity: orderItems.quantity,
            price: orderItems.price,
            gstRate: orderItems.gstRate,
            gstAmount: orderItems.gstAmount,
            createdAt: orderItems.createdAt,
            updatedAt: orderItems.updatedAt,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, id));
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "AdminOrdersController.findOne.selectItems",
            error,
            { orderId: id },
          ),
          "Failed to fetch order items",
        );
        items = [];
      }

      // Get shipping address for GST calculation
      let shippingAddress: { state: string } | undefined;
      try {
        const addressResult = await this.db
          .select({ state: addresses.state })
          .from(addresses)
          .where(eq(addresses.id, order.shippingAddressId))
          .limit(1);
        shippingAddress = addressResult[0];
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "AdminOrdersController.findOne.selectAddress",
            {
              orderId: id,
              shippingAddressId: order.shippingAddressId,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to fetch shipping address, using default state",
        );
        shippingAddress = undefined;
      }

      // Calculate GST breakdown (using Maharashtra as seller state)
      const sellerState = "Maharashtra";
      const buyerState = shippingAddress?.state || "";

      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      for (const item of items) {
        try {
          const itemSubtotal = item.price * item.quantity;
          const gstBreakdown = calculateGstBreakdown(
            itemSubtotal,
            item.gstRate,
            sellerState,
            buyerState,
          );
          totalCgst += gstBreakdown.cgst;
          totalSgst += gstBreakdown.sgst;
          totalIgst += gstBreakdown.igst;
        } catch (error) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "AdminOrdersController.findOne.calculateGst",
              {
                orderId: id,
                itemId: item.id,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to calculate GST for item, skipping",
          );
        }
      }

      const gstBreakdown = {
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        totalGst: order.gstAmount || 0,
        isIntraState: sellerState === buyerState,
      };

      // Validate and parse payment fee breakdown
      let paymentFeeBreakdown:
        | {
            method: string;
            chargeType: string;
            calculatedFee: number;
            flatAmount?: number;
            percentage?: number;
            mixMin?: number;
            mixCap?: number;
          }
        | null
        | undefined = null;

      if (order.paymentFeeBreakdown) {
        try {
          const parsed =
            typeof order.paymentFeeBreakdown === "string"
              ? JSON.parse(order.paymentFeeBreakdown)
              : order.paymentFeeBreakdown;

          if (
            parsed &&
            typeof parsed === "object" &&
            "method" in parsed &&
            "chargeType" in parsed &&
            "calculatedFee" in parsed &&
            typeof parsed.method === "string" &&
            typeof parsed.chargeType === "string" &&
            typeof parsed.calculatedFee === "number"
          ) {
            paymentFeeBreakdown = parsed as {
              method: string;
              chargeType: string;
              calculatedFee: number;
              flatAmount?: number;
              percentage?: number;
              mixMin?: number;
              mixCap?: number;
            };
          }
        } catch (error) {
          this.logger.warn(
            createLogContext(
              this.contextService,
              "AdminOrdersController.findOne.parsePaymentFeeBreakdown",
              {
                orderId: id,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to parse payment fee breakdown",
          );
        }
      }

      return {
        id: order.id,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal || 0,
        gstAmount: order.gstAmount || 0,
        gstBreakdown,
        shippingCost: order.shippingCost || 0,
        paymentFee: order.paymentFee || undefined,
        paymentMethod: order.paymentMethod || null,
        paymentFeeBreakdown,
        total: order.total || 0,
        razorpayOrderId: order.razorpayOrderId || null,
        shippingProvider: order.shippingProvider || null,
        shippingAddressId: order.shippingAddressId,
        billingAddressId: order.billingAddressId,
        items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        archived: order.archived || false,
        archivedAt: order.archivedAt || null,
        archivedBy: order.archivedBy || null,
        ...(order.discountCode !== null && order.discountCode !== undefined
          ? { discountCode: order.discountCode }
          : {}),
        ...(order.discountAmount !== null && order.discountAmount !== undefined
          ? { discountAmount: order.discountAmount }
          : {}),
      } as OrderResponseDto & {
        discountCode?: string | null;
        discountAmount?: number;
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(
          this.contextService,
          "AdminOrdersController.findOne",
          error,
          { orderId: id },
        ),
        "Failed to get order",
      );
      throw new InternalServerErrorException("Failed to retrieve order");
    }
  }

  @Get(":id/timeline")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get order timeline (admin)",
    description:
      "Returns a chronological timeline of all events related to the order including status changes, payments, and shipments (admin only).",
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
    status: 404,
    description: "Order not found",
  })
  async getTimeline(@Param("id") id: string): Promise<OrderTimelineDto> {
    // Admin can access any order, so we pass null as userId
    // The timeline service will need to handle this case
    return this.timelineService.getTimelineForAdmin(id);
  }

  @Get(":id/tracking")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get order tracking information (admin)",
    description:
      "Returns tracking information for an order including shipment details and tracking numbers (admin only).",
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
    status: 404,
    description: "Order not found",
  })
  async getTracking(@Param("id") id: string): Promise<OrderTrackingDto> {
    // Admin can access any order, so we pass null as userId
    return this.timelineService.getTrackingForAdmin(id);
  }

  @Patch(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update order status (admin)",
    description:
      "Updates the status of an order. Validates status transitions according to order workflow (admin only).",
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
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async updateStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    // Admin can update any order, so we pass null as userId
    return this.statusService.updateStatusForAdmin(id, updateStatusDto);
  }

  @Post(":id/mark-paid")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Mark COD order as paid (admin)",
    description:
      "Manually mark a Cash on Delivery order as paid. Only works for COD orders that are not already paid.",
  })
  @ApiResponse({
    status: 200,
    description: "Order marked as paid successfully",
    type: MarkOrderPaidResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (not COD, already paid, etc.)",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async markOrderAsPaid(
    @Request() req: AuthenticatedRequest,
    @Param("id") orderId: string,
  ): Promise<MarkOrderPaidResponseDto> {
    return (await this.orderPaymentService.markAsPaid(
      orderId,
      req.user.userId,
      req.user.email.split("@")[0],
      req.user.email,
    )) as unknown as MarkOrderPaidResponseDto;
  }

  @Post(":id/refund")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Create refund for an order (admin)",
    description:
      "Create a refund for an order. Refund will be processed via payment provider if available.",
  })
  @ApiResponse({
    status: 201,
    description: "Refund created successfully",
    type: RefundResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request (invalid amount, exceeds refundable amount, etc.)",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async createRefund(
    @Param("id") orderId: string,
    @Body() createRefundDto: CreateRefundDto,
  ): Promise<RefundResponseDto> {
    return (await this.refundsService.create(
      orderId,
      createRefundDto.amount,
      createRefundDto.reason,
    )) as unknown as RefundResponseDto;
  }

  @Get(":id/refunds")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all refunds for an order (admin)",
    description: "Retrieve all refunds associated with an order.",
  })
  @ApiResponse({
    status: 200,
    description: "List of refunds retrieved successfully",
    type: [RefundResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async getRefunds(@Param("id") orderId: string): Promise<RefundResponseDto[]> {
    return (await this.refundsService.findByOrderId(
      orderId,
    )) as unknown as RefundResponseDto[];
  }

  @Get(":id/notes")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all notes for an order (admin)",
    description:
      "Retrieve all notes (both admin and customer-visible) for an order.",
  })
  @ApiResponse({
    status: 200,
    description: "List of notes retrieved successfully",
    type: [OrderNoteResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async getOrderNotes(
    @Param("id") orderId: string,
  ): Promise<OrderNoteResponseDto[]> {
    return (await this.orderNotesService.findByOrderId(
      orderId,
    )) as unknown as OrderNoteResponseDto[];
  }

  @Post(":id/notes")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Create note for an order (admin)",
    description:
      "Add a note to an order. Notes can be admin-only or customer-visible.",
  })
  @ApiResponse({
    status: 201,
    description: "Note created successfully",
    type: OrderNoteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (empty note, etc.)",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async createOrderNote(
    @Request() req: AuthenticatedRequest,
    @Param("id") orderId: string,
    @Body() createNoteDto: CreateOrderNoteDto,
  ): Promise<OrderNoteResponseDto> {
    return (await this.orderNotesService.create(
      orderId,
      createNoteDto.note,
      createNoteDto.isPublic || false,
      req.user.userId,
      req.user.email.split("@")[0],
      req.user.email,
    )) as unknown as OrderNoteResponseDto;
  }

  @Patch(":id/addresses")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update order address (admin)",
    description:
      "Update shipping or billing address for an order. Validates address fields and PIN code format.",
  })
  @ApiResponse({
    status: 200,
    description: "Address updated successfully",
    type: MarkOrderPaidResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (invalid address fields, PIN code format, etc.)",
  })
  @ApiResponse({
    status: 404,
    description: "Order or address not found",
  })
  async updateOrderAddress(
    @Request() req: AuthenticatedRequest,
    @Param("id") orderId: string,
    @Body() updateAddressDto: UpdateOrderAddressDto,
  ): Promise<MarkOrderPaidResponseDto> {
    return (await this.orderAddressService.updateAddress(
      orderId,
      updateAddressDto.addressType,
      {
        street: updateAddressDto.street,
        city: updateAddressDto.city,
        state: updateAddressDto.state,
        pincode: updateAddressDto.pincode,
        country: updateAddressDto.country,
        district: updateAddressDto.district,
      },
      req.user.userId,
    )) as unknown as MarkOrderPaidResponseDto;
  }

  @Post("reconcile/:paymentIntentId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Reconcile payment intent (admin only)",
    description:
      "Manually reprocess a payment intent to create an order. Safe to call multiple times - idempotent. Use this for recovery after failures. Admin-only endpoint.",
  })
  @ApiParam({
    name: "paymentIntentId",
    description: "Payment intent ID from provider (e.g., Razorpay order ID)",
    example: "order_abc123",
  })
  @ApiQuery({
    name: "provider",
    description: "Payment provider (default: razorpay)",
    required: false,
    example: "razorpay",
  })
  @ApiResponse({
    status: 200,
    description: "Order created or found",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (payment not confirmed, invalid state, etc.)",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden (admin role required)",
  })
  @ApiResponse({
    status: 404,
    description: "Payment intent or checkout session not found",
  })
  async reconcile(
    @Param("paymentIntentId") paymentIntentId: string,
    @Query("provider") provider?: string,
  ): Promise<OrderResponseDto | null> {
    return this.reconciliationService.reprocessPaymentIntent(
      paymentIntentId,
      provider || "razorpay",
    );
  }

  @Post(":id/cancel")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Cancel order (admin)",
    description:
      "Cancels an order. Admins can cancel orders in any status except cancelled or refunded. Inventory will be released back to available stock.",
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
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async cancelOrder(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() cancelDto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    return this.cancelService.cancelOrderForAdmin(
      id,
      cancelDto,
      req.user.userId,
    );
  }

  @Post(":id/archive")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Archive order (admin)",
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
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async archiveOrder(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<OrderResponseDto> {
    return this.archiveService.archiveOrderForAdmin(id, req.user.userId);
  }

  @Post(":id/unarchive")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Unarchive order (admin)",
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
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async unarchiveOrder(@Param("id") id: string): Promise<OrderResponseDto> {
    return this.archiveService.unarchiveOrderForAdmin(id);
  }

  @Post(":id/duplicate")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Duplicate order (admin)",
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
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async duplicateOrder(
    @Param("id") id: string,
    @Body() duplicateDto: DuplicateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.duplicateService.duplicateOrderForAdmin(id, duplicateDto);
  }
}
