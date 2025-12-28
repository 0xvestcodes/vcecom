import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ExtendedRequest } from "../../common/logging/types";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { AdminInventoryService } from "./admin-inventory.service";
import {
  AdjustInventoryDto,
  InventoryAdjustmentResponseDto,
} from "./dto/adjust-inventory.dto";
import {
  BulkAdjustInventoryDto,
  BulkAdjustInventoryResponseDto,
} from "./dto/bulk-adjust.dto";
import { InventoryHealthResponseDto } from "./dto/inventory-health.dto";
import { InventoryItemResponseDto } from "./dto/inventory-item.dto";
import {
  InventoryLogsQueryDto,
  PaginatedInventoryLogsResponseDto,
} from "./dto/inventory-logs.dto";
import { CartStateMetricsDto } from "./dto/cart-state-metrics.dto";
import { InventoryMetricsDto } from "./dto/inventory-metrics.dto";
import {
  InventoryReservationsResponseDto,
  ReservationsSummaryResponseDto,
} from "./dto/inventory-reservations.dto";
import {
  InventorySettingsResponseDto,
  UpdateInventorySettingsDto,
} from "./dto/inventory-settings.dto";
import { VariantsIndexResponseDto } from "./dto/inventory-variants-index.dto";
import {
  ListInventoryQueryDto,
  PaginatedInventoryResponseDto,
} from "./dto/list-inventory.dto";
import { InventoryService } from "./inventory.service";

@ApiTags("admin")
@Controller("admin/inventory")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
export class AdminInventoryController {
  constructor(
    private readonly adminInventoryService: AdminInventoryService,
    private readonly inventoryService: InventoryService,
  ) {}

  // IMPORTANT: Specific routes must come BEFORE parameterized routes
  // Otherwise :variantId will match routes like "settings", "health", etc.

  @Get("variants/index")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get variants index",
    description:
      "Get quick SKU/variant map useful for bulk actions and dropdowns. Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Variants index retrieved successfully",
    type: VariantsIndexResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getVariantsIndex(): Promise<VariantsIndexResponseDto> {
    return this.adminInventoryService.getVariantsIndex();
  }

  @Get("metrics")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get inventory health metrics",
    description:
      "Returns inventory health metrics including available, reserved, reserved ratio, expired reservations count, and failed reservations count. Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory metrics retrieved successfully",
    type: InventoryMetricsDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getMetrics(): Promise<InventoryMetricsDto> {
    return this.adminInventoryService.getMetrics();
  }

  @Get("cart-state-metrics")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get cart state metrics",
    description:
      "Returns counts of cart items in each state (fresh, stale, reacquired, committed) and stale recovery rate. Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Cart state metrics retrieved successfully",
    type: CartStateMetricsDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getCartStateMetrics(): Promise<CartStateMetricsDto> {
    return this.adminInventoryService.getCartStateMetrics();
  }

  @Get("health")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get inventory health dashboard",
    description:
      "Get system-wide inventory metrics including total stock, available stock, committed stock, low stock count, out of stock count, and fastest/slowest moving SKUs. Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory health metrics retrieved successfully",
    type: InventoryHealthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getInventoryHealth(): Promise<InventoryHealthResponseDto> {
    return this.adminInventoryService.getInventoryHealth();
  }

  @Get("settings")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get inventory settings",
    description:
      "Get low stock threshold settings (global and per-variant overrides). Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory settings retrieved successfully",
    type: InventorySettingsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getInventorySettings(): Promise<InventorySettingsResponseDto> {
    return this.adminInventoryService.getInventorySettings();
  }

  @Post("settings")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update inventory settings",
    description:
      "Update low stock threshold settings (global and per-variant overrides). Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory settings updated successfully",
    type: InventorySettingsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid settings",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async updateInventorySettings(
    @Body() dto: UpdateInventorySettingsDto,
    @Request() req: ExtendedRequest,
  ): Promise<InventorySettingsResponseDto> {
    // User is guaranteed to exist by JwtAuthGuard and RolesGuard
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException("User ID not found in request");
    }
    return this.adminInventoryService.updateInventorySettings(dto, userId);
  }

  @Get("reservations/summary")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get reservations summary",
    description:
      "Get system-wide committed inventory overview across all variants. Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Reservations summary retrieved successfully",
    type: ReservationsSummaryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getReservationsSummary(): Promise<ReservationsSummaryResponseDto> {
    return this.adminInventoryService.getReservationsSummary();
  }

  // Root list endpoint - must come after all specific routes but before :variantId
  @Get()
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "List inventory with pagination and filters",
    description:
      "Get paginated inventory list across all variants with search, filters, and sorting. Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory list retrieved successfully",
    type: PaginatedInventoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async listInventory(
    @Query() query: ListInventoryQueryDto,
  ): Promise<PaginatedInventoryResponseDto> {
    return this.adminInventoryService.listInventory(query);
  }

  // Parameterized routes MUST come LAST
  @Get(":variantId")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get single variant inventory details",
    description:
      "Get detailed inventory information for a specific variant including inventory, committed, available, low stock threshold, and last adjustment. Admin access required.",
  })
  @ApiParam({
    name: "variantId",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory item retrieved successfully",
    type: InventoryItemResponseDto,
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
    description: "Variant not found",
  })
  async getInventoryItem(
    @Param("variantId") variantId: string,
  ): Promise<InventoryItemResponseDto> {
    return this.adminInventoryService.getInventoryItem(variantId);
  }

  @Get(":variantId/logs")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get inventory logs for a variant",
    description:
      "Get paginated audit logs for inventory adjustments for a specific variant. Supports filtering by date range, actor, reason, type, orderId, and refundId. Admin access required.",
  })
  @ApiParam({
    name: "variantId",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory logs retrieved successfully",
    type: PaginatedInventoryLogsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getInventoryLogs(
    @Param("variantId") variantId: string,
    @Query() query: InventoryLogsQueryDto,
  ): Promise<PaginatedInventoryLogsResponseDto> {
    return this.adminInventoryService.getInventoryLogs(variantId, query);
  }

  @Get(":variantId/reservations")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get real-time reservations for a variant",
    description:
      "Get real-time Redis reservation information for a specific variant including active reservations with cart IDs, quantities, and expiration times. Admin access required.",
  })
  @ApiParam({
    name: "variantId",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Variant reservations retrieved successfully",
    type: InventoryReservationsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getVariantReservations(
    @Param("variantId") variantId: string,
  ): Promise<InventoryReservationsResponseDto> {
    return this.adminInventoryService.getVariantReservations(variantId);
  }

  @Post(":variantId/adjust")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Adjust inventory for a variant",
    description:
      "Perform atomic inventory adjustment (increase, decrease, or set) with full audit logging. Updates both database and Redis atomically. Admin access required.",
  })
  @ApiParam({
    name: "variantId",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory adjusted successfully",
    type: InventoryAdjustmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid adjustment",
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
    description: "Variant not found",
  })
  async adjustInventory(
    @Param("variantId") variantId: string,
    @Body() dto: AdjustInventoryDto,
    @Request() req: ExtendedRequest,
  ): Promise<InventoryAdjustmentResponseDto> {
    // User is guaranteed to exist by JwtAuthGuard and RolesGuard
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException("User ID not found in request");
    }
    return this.adminInventoryService.adjustInventory(variantId, dto, userId);
  }

  @Post("bulk-adjust")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Bulk adjust inventory",
    description:
      "Perform bulk inventory adjustments for multiple variants. Useful for CSV uploads or bulk UI edits. Returns success/failure for each SKU. Admin access required.",
  })
  @ApiResponse({
    status: 200,
    description: "Bulk adjustments processed",
    type: BulkAdjustInventoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid adjustments",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async bulkAdjust(
    @Body() dto: BulkAdjustInventoryDto,
    @Request() req: ExtendedRequest,
  ): Promise<BulkAdjustInventoryResponseDto> {
    // User is guaranteed to exist by JwtAuthGuard and RolesGuard
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException("User ID not found in request");
    }
    return this.adminInventoryService.bulkAdjust(dto, userId);
  }
}
