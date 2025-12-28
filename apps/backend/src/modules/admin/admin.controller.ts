import {
  Body,
  Controller,
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
import { OrderAddressService } from "../orders/services/order-address.service";
import { OrderNotesService } from "../orders/services/order-notes.service";
import { OrderPaymentService } from "../orders/services/payment/order-payment.service";
import { RefundsService } from "../orders/services/refunds.service";
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
    return (await this.orderPaymentService.markAsPaid(
      orderId,
      req.user.userId,
      req.user.email.split("@")[0],
      req.user.email,
    )) as unknown as MarkOrderPaidResponseDto;
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
    return (await this.refundsService.create(
      orderId,
      createRefundDto.amount,
      createRefundDto.reason,
    )) as unknown as RefundResponseDto;
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
    return (await this.refundsService.findByOrderId(
      orderId,
    )) as unknown as RefundResponseDto[];
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
    return (await this.orderNotesService.findByOrderId(
      orderId,
    )) as unknown as OrderNoteResponseDto[];
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
    return (await this.orderNotesService.create(
      orderId,
      createNoteDto.note,
      createNoteDto.isPublic || false,
      req.user.userId,
      req.user.email.split("@")[0],
      req.user.email,
    )) as unknown as OrderNoteResponseDto;
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
}
