import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../common/constants";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { FraudBlacklistService } from "../fraud-detection/fraud-blacklist.service";
import { FraudDetectionService } from "../fraud-detection/fraud-detection.service";
import { OrderAddressService } from "../orders/services/operations/order-address.service";
import { OrderNotesService } from "../orders/services/operations/order-notes.service";
import { OrderPaymentService } from "../orders/services/payment/order-payment.service";
import { RefundsService } from "../orders/services/payment/refunds.service";
import { AdminService } from "./admin.service";
import {
  AdminQueryAbandonedCheckoutsDto,
  PaginatedAbandonedCheckoutsResponseDto,
} from "./dto/admin-abandoned-checkouts.dto";
import {
  AdminQueryCustomersDto,
  PaginatedCustomersResponseDto,
} from "./dto/admin-customers.dto";
import {
  AdminQueryOrdersDto,
  PaginatedOrdersResponseDto,
} from "./dto/admin-orders.dto";
import {
  AdminQueryProductsDto,
  PaginatedProductsResponseDto,
} from "./dto/admin-products.dto";
import { AdminStatsResponseDto } from "./dto/admin-stats.dto";
import {
  BulkProductOperationDto,
  BulkProductOperationResponseDto,
} from "./dto/bulk-operations.dto";
import { CreateOrderNoteDto } from "./dto/create-order-note.dto";
import { CreateRefundDto } from "./dto/create-refund.dto";
import {
  AddToBlacklistDto,
  BlacklistType,
  FraudBlacklistDto,
  FraudFlaggedOrderDto,
  FraudRiskScoreDto,
  PaginatedBlacklistResponseDto,
  PaginatedFlaggedOrdersResponseDto,
  ReviewOrderDto,
} from "./dto/fraud-detection.dto";
import { MarkOrderPaidResponseDto } from "./dto/mark-order-paid.dto";
import { OrderNoteResponseDto } from "./dto/order-note-response.dto";
import { RefundResponseDto } from "./dto/refund-response.dto";
import { UpdateOrderAddressDto } from "./dto/update-order-address.dto";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@ApiTags("admin")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly orderNotesService: OrderNotesService,
    private readonly refundsService: RefundsService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly orderAddressService: OrderAddressService,
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly fraudBlacklistService: FraudBlacklistService,
  ) {}

  @Get("products")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all products (admin)",
    description:
      "Retrieve a paginated list of all products with search and filters. Admin-only endpoint.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: `Items per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`,
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search query (searches in title, description, and SKU)",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "active", "archived"],
    description: "Filter by status",
  })
  @ApiQuery({
    name: "categoryId",
    required: false,
    type: String,
    description: "Filter by category ID",
  })
  @ApiQuery({
    name: "minPrice",
    required: false,
    type: Number,
    description: "Minimum price filter (INR)",
  })
  @ApiQuery({
    name: "maxPrice",
    required: false,
    type: Number,
    description: "Maximum price filter (INR)",
  })
  @ApiQuery({
    name: "inStock",
    required: false,
    type: Boolean,
    description:
      "Filter by availability (true = in stock, false = out of stock)",
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["price", "name", "date"],
    description: "Sort field (default: date)",
  })
  @ApiQuery({
    name: "sortOrder",
    required: false,
    enum: ["asc", "desc"],
    description: "Sort order (default: desc)",
  })
  @ApiResponse({
    status: 200,
    description: "List of products retrieved successfully",
    type: PaginatedProductsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getProducts(
    @Query() query: AdminQueryProductsDto,
  ): Promise<PaginatedProductsResponseDto> {
    return this.adminService.getAllProducts(query);
  }

  @Get("orders")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all orders (admin)",
    description:
      "Retrieve a paginated list of all orders with filters (status, date range). Admin-only endpoint.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: `Items per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`,
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ],
    description: "Filter orders by status",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "Filter orders from this date (ISO 8601 format)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description: "Filter orders until this date (ISO 8601 format)",
  })
  @ApiResponse({
    status: 200,
    description: "List of orders retrieved successfully",
    type: PaginatedOrdersResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getOrders(
    @Query() query: AdminQueryOrdersDto,
  ): Promise<PaginatedOrdersResponseDto> {
    return await this.adminService.getAllOrders(query);
  }

  @Get("customers")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all customers (admin)",
    description:
      "Retrieve a paginated list of all customers with search. Admin-only endpoint.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: `Items per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`,
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search query (searches in name, email, phone)",
  })
  @ApiResponse({
    status: 200,
    description: "List of customers retrieved successfully",
    type: PaginatedCustomersResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getCustomers(
    @Query() query: AdminQueryCustomersDto,
  ): Promise<PaginatedCustomersResponseDto> {
    return this.adminService.getAllCustomers(query);
  }

  @Get("stats")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get dashboard statistics (admin)",
    description:
      "Retrieve dashboard statistics including total products, orders, customers, and revenue metrics. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "Dashboard statistics retrieved successfully",
    type: AdminStatsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getStats(): Promise<AdminStatsResponseDto> {
    return this.adminService.getStats();
  }

  @Post("products/bulk")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Perform bulk operations on products (admin)",
    description:
      "Perform bulk operations (activate, archive, delete) on multiple products. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "Bulk operation completed successfully",
    type: BulkProductOperationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid operation or product IDs",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async bulkProductOperation(
    @Body() dto: BulkProductOperationDto,
  ): Promise<BulkProductOperationResponseDto> {
    return this.adminService.bulkProductOperation(dto);
  }

  @Get("abandoned-checkouts")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get abandoned checkouts (admin)",
    description:
      "Retrieve a paginated list of abandoned checkouts (carts with checkout sessions in CREATED or LOCKED state but no orders). Admin-only endpoint.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: `Items per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`,
  })
  @ApiQuery({
    name: "recoverable",
    required: false,
    type: Boolean,
    description: "Filter by recoverable status (has payment intent)",
  })
  @ApiQuery({
    name: "hasEmail",
    required: false,
    type: Boolean,
    description: "Filter by whether cart has customer email",
  })
  @ApiQuery({
    name: "minValue",
    required: false,
    type: Number,
    description: "Minimum cart value",
  })
  @ApiResponse({
    status: 200,
    description: "List of abandoned checkouts retrieved successfully",
    type: PaginatedAbandonedCheckoutsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getAbandonedCheckouts(
    @Query() query: AdminQueryAbandonedCheckoutsDto,
  ): Promise<PaginatedAbandonedCheckoutsResponseDto> {
    return this.adminService.getAbandonedCheckouts(query);
  }

  @Get("abandoned-checkouts/:cartId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get abandoned checkout by cart ID (admin)",
    description:
      "Retrieve a single abandoned checkout by cart ID. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "Abandoned checkout retrieved successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Abandoned checkout not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getAbandonedCheckoutByCartId(@Param("cartId") cartId: string) {
    const checkout =
      await this.adminService.getAbandonedCheckoutByCartId(cartId);
    if (!checkout) {
      throw new NotFoundException("Abandoned checkout not found");
    }
    return checkout;
  }

  @Get("abandoned-carts/stats")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get abandoned cart statistics (admin)",
    description:
      "Retrieve statistics about abandoned carts including recovery rate and revenue recovered. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "Abandoned cart statistics retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getAbandonedCartStats() {
    return this.adminService.getAbandonedCartStats();
  }

  @Get("abandoned-carts/analytics")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get abandoned cart analytics (admin)",
    description:
      "Retrieve detailed analytics about abandoned carts including trends over time and top abandoned products. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "Abandoned cart analytics retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getAbandonedCartAnalytics(
    @Query() query: {
      startDate?: string;
      endDate?: string;
      minValue?: number;
      customerId?: string;
    },
  ) {
    return this.adminService.getAbandonedCartAnalytics(query);
  }

  @Get("abandoned-carts/recovery-stats")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get recovery campaign statistics (admin)",
    description:
      "Retrieve statistics about recovery campaigns including performance metrics. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "Recovery campaign statistics retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getRecoveryCampaignStats() {
    return this.adminService.getRecoveryCampaignStats();
  }

  @Post("orders/:orderId/mark-paid")
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
    @Param("orderId") orderId: string,
  ): Promise<MarkOrderPaidResponseDto> {
    return await this.orderPaymentService.markAsPaid(
      orderId,
      req.user.userId,
      req.user.email.split("@")[0],
      req.user.email,
    );
  }

  @Post("orders/:orderId/refund")
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
    @Param("orderId") orderId: string,
    @Body() createRefundDto: CreateRefundDto,
  ): Promise<RefundResponseDto> {
    return await this.refundsService.create(
      orderId,
      createRefundDto.amount,
      createRefundDto.reason,
    );
  }

  @Get("orders/:orderId/refunds")
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
  async getRefunds(
    @Param("orderId") orderId: string,
  ): Promise<RefundResponseDto[]> {
    return await this.refundsService.findByOrderId(orderId);
  }

  @Get("orders/:orderId/notes")
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
    @Param("orderId") orderId: string,
  ): Promise<OrderNoteResponseDto[]> {
    return await this.orderNotesService.findByOrderId(orderId);
  }

  @Post("orders/:orderId/notes")
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
    @Param("orderId") orderId: string,
    @Body() createNoteDto: CreateOrderNoteDto,
  ): Promise<OrderNoteResponseDto> {
    return await this.orderNotesService.create(
      orderId,
      createNoteDto.note,
      createNoteDto.isPublic || false,
      req.user.userId,
      req.user.email.split("@")[0],
      req.user.email,
    );
  }

  @Patch("orders/:orderId/addresses")
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
    @Param("orderId") orderId: string,
    @Body() updateAddressDto: UpdateOrderAddressDto,
  ): Promise<MarkOrderPaidResponseDto> {
    return await this.orderAddressService.updateAddress(
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
    );
  }

  // ============================================================================
  // Fraud Detection Endpoints
  // ============================================================================

  @Get("fraud/blacklists")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get fraud blacklists (admin)",
    description:
      "Retrieve paginated list of fraud blacklists with optional filtering by type",
  })
  @ApiResponse({
    status: 200,
    description: "Blacklists retrieved successfully",
    type: PaginatedBlacklistResponseDto,
  })
  @ApiQuery({
    name: "type",
    required: false,
    description: "Filter by blacklist type (email, phone, address)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Items per page (default: 10)",
  })
  async getBlacklists(
    @Query("type") type?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PaginatedBlacklistResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = Math.min(limit ? parseInt(limit, 10) : 10, MAX_PAGE_SIZE);

    const blacklists = await this.fraudBlacklistService.getAllBlacklists(
      type as BlacklistType | undefined,
    );
    const total = blacklists.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    // Map database results to DTO format, converting type to BlacklistType enum
    const mappedBlacklists: FraudBlacklistDto[] = blacklists
      .slice(startIndex, endIndex)
      .map((entry) => ({
        id: entry.id,
        type: entry.type as BlacklistType,
        value: entry.value,
        reason: entry.reason,
        createdBy: entry.createdBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));

    return {
      data: mappedBlacklists,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Post("fraud/blacklists")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Add entry to fraud blacklist (admin)",
    description: "Add an email, phone, or address to the fraud blacklist",
  })
  @ApiResponse({
    status: 201,
    description: "Entry added to blacklist successfully",
    type: FraudBlacklistDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid blacklist data",
  })
  async addToBlacklist(
    @Request() req: AuthenticatedRequest,
    @Body() addToBlacklistDto: AddToBlacklistDto,
  ): Promise<FraudBlacklistDto> {
    const result = await this.fraudBlacklistService.addToBlacklist(
      addToBlacklistDto.type,
      addToBlacklistDto.value,
      addToBlacklistDto.reason || null,
      req.user.userId,
    );
    // Map database result to DTO format
    return {
      id: result.id,
      type: result.type as BlacklistType,
      value: result.value,
      reason: result.reason,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  @Delete("fraud/blacklists/:id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Remove entry from fraud blacklist (admin)",
    description: "Remove an entry from the fraud blacklist",
  })
  @ApiResponse({
    status: 200,
    description: "Entry removed from blacklist successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Blacklist entry not found",
  })
  async removeFromBlacklist(@Param("id") id: string): Promise<void> {
    const result = await this.fraudBlacklistService.removeFromBlacklist(id);
    if (!result) {
      throw new NotFoundException("Blacklist entry not found");
    }
  }

  @Get("fraud/flagged-orders")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get flagged orders for review (admin)",
    description: "Retrieve paginated list of orders flagged for fraud review",
  })
  @ApiResponse({
    status: 200,
    description: "Flagged orders retrieved successfully",
    type: PaginatedFlaggedOrdersResponseDto,
  })
  async getFlaggedOrders(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PaginatedFlaggedOrdersResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = Math.min(limit ? parseInt(limit, 10) : 10, MAX_PAGE_SIZE);

    const flaggedOrders = await this.fraudDetectionService.getFlaggedOrders(
      limitNum,
      (pageNum - 1) * limitNum,
    );

    // Map database results to DTO format
    const mappedOrders: FraudFlaggedOrderDto[] = flaggedOrders.map((order) => ({
      id: order.id,
      orderId: order.orderId,
      riskScore: order.riskScore,
      riskFactors: order.riskFactors,
      flagged: order.flagged,
      reviewedBy: order.reviewedBy,
      reviewedAt: order.reviewedAt,
      reviewNotes: order.reviewNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    return {
      data: mappedOrders,
      total: flaggedOrders.length, // This is simplified - in production you'd get total count separately
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(flaggedOrders.length / limitNum),
    };
  }

  @Post("fraud/orders/:orderId/review")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Mark order as reviewed (admin)",
    description: "Mark a flagged order as reviewed by admin",
  })
  @ApiResponse({
    status: 200,
    description: "Order marked as reviewed successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async reviewOrder(
    @Request() req: AuthenticatedRequest,
    @Param("orderId") orderId: string,
    @Body() reviewOrderDto: ReviewOrderDto,
  ): Promise<void> {
    await this.fraudDetectionService.markOrderReviewed(
      orderId,
      req.user.userId,
      reviewOrderDto.notes,
    );
  }

  @Get("fraud/risk-scores/:orderId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get risk score details for an order (admin)",
    description:
      "Retrieve detailed risk score information for a specific order",
  })
  @ApiResponse({
    status: 200,
    description: "Risk score retrieved successfully",
    type: FraudRiskScoreDto,
  })
  @ApiResponse({
    status: 404,
    description: "Risk score not found",
  })
  async getRiskScore(
    @Param("orderId") orderId: string,
  ): Promise<FraudRiskScoreDto> {
    const riskScore = await this.fraudDetectionService.getRiskScore(orderId);
    if (!riskScore) {
      throw new NotFoundException("Risk score not found for this order");
    }
    // Map database result to DTO format
    return {
      id: riskScore.id,
      orderId: riskScore.orderId,
      riskScore: riskScore.riskScore,
      riskFactors: riskScore.riskFactors,
      flagged: riskScore.flagged,
      reviewedBy: riskScore.reviewedBy,
      reviewedAt: riskScore.reviewedAt,
      reviewNotes: riskScore.reviewNotes,
      createdAt: riskScore.createdAt,
      updatedAt: riskScore.updatedAt,
    };
  }
}
