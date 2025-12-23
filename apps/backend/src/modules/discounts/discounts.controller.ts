import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
  TooManyRequestsErrorDto,
  UnauthorizedErrorDto,
} from "../../common/dto/error-response.dto";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DriftSeverity } from "./audit/discount-audit.types";
import { DiscountsService } from "./discounts.service";
import { CreateDiscountDto } from "./dto/create-discount.dto";
import { DiscountResponseDto } from "./dto/discount-response.dto";
import { UpdateDiscountDto } from "./dto/update-discount.dto";
import { ValidateDiscountDto } from "./dto/validate-discount.dto";
import {
  AdminDriftReportService,
  DriftReportQuery,
} from "./services/admin-drift-report.service";
import { DiscountInvalidationService } from "./services/discount-invalidation.service";
import { DiscountProfiler } from "./services/discount-profiler.service";
import { RulesetRebuilder } from "./services/ruleset-rebuilder.service";

@ApiTags("admin")
@Controller("admin/discounts")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class DiscountsController {
  constructor(
    private readonly discountsService: DiscountsService,
    private readonly adminDriftReportService: AdminDriftReportService,
    private readonly discountProfiler: DiscountProfiler,
    private readonly invalidationService: DiscountInvalidationService,
    private readonly rulesetRebuilder: RulesetRebuilder,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a new discount code",
    description:
      "Create a new discount code with STANDARD or BUY_GET type. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 201,
    description: "Discount created successfully",
    type: DiscountResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid discount data or code already exists",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Discount code already exists",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 422,
    description: "Unprocessable entity - Invalid discount rules or conditions",
    type: BadRequestErrorDto,
  })
  async create(
    @Body() createDiscountDto: CreateDiscountDto,
  ): Promise<DiscountResponseDto> {
    return this.discountsService.create(createDiscountDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all discount codes",
    description:
      "Retrieve a paginated list of all discount codes. Admin-only endpoint.",
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
    description: "Items per page (default: 10, max: 100)",
  })
  @ApiResponse({
    status: 200,
    description: "List of discounts retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - Rate limit exceeded",
    type: TooManyRequestsErrorDto,
  })
  async findAll(@Query("page") page?: number, @Query("limit") limit?: number) {
    return this.discountsService.findAll(page || 1, limit || 10);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get discount by ID",
    description:
      "Retrieve a specific discount code by ID. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Discount ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Discount retrieved successfully",
    type: DiscountResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Discount not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
    type: ForbiddenErrorDto,
  })
  async findOne(@Param("id") id: string): Promise<DiscountResponseDto> {
    return this.discountsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({
    summary: "Update discount code",
    description: "Update an existing discount code. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Discount ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Discount updated successfully",
    type: DiscountResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid discount data",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Discount not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Discount update conflicts with existing data",
    type: ConflictErrorDto,
  })
  @ApiResponse({
    status: 422,
    description: "Unprocessable entity - Invalid discount rules",
    type: BadRequestErrorDto,
  })
  async update(
    @Param("id") id: string,
    @Body() updateDiscountDto: UpdateDiscountDto,
  ): Promise<DiscountResponseDto> {
    return this.discountsService.update(id, updateDiscountDto);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete discount code",
    description: "Delete a discount code. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Discount ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Discount deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Discount not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Discount is in use and cannot be deleted",
    type: ConflictErrorDto,
  })
  async remove(@Param("id") id: string): Promise<{ message: string }> {
    return this.discountsService.remove(id);
  }

  @Get("drift-report")
  @ApiOperation({
    summary: "Get discount drift report (admin)",
    description: "Retrieve drift detection events with filtering options",
  })
  @ApiQuery({ name: "cartId", required: false, type: String })
  @ApiQuery({ name: "checkoutId", required: false, type: String })
  @ApiQuery({ name: "orderId", required: false, type: String })
  @ApiQuery({ name: "paymentIntentId", required: false, type: String })
  @ApiQuery({ name: "dateFrom", required: false, type: Date })
  @ApiQuery({ name: "dateTo", required: false, type: Date })
  @ApiQuery({ name: "severity", required: false, enum: DriftSeverity })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Drift report retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getDriftReport(@Query() query: DriftReportQuery) {
    return this.adminDriftReportService.getDriftReport(query);
  }

  @Get("profile")
  @ApiOperation({
    summary: "Get discount profiler metrics (admin)",
    description:
      "Retrieve performance metrics for discount engine and hot reload system",
  })
  @ApiResponse({
    status: 200,
    description: "Profiler metrics retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getProfile() {
    return this.discountProfiler.getMetrics();
  }

  @Post("refresh-cache")
  @ApiOperation({
    summary: "Refresh discount cache (admin)",
    description:
      "Manually trigger a refresh of the discount cache in Redis. This rebuilds the discount ruleset bundle from the database.",
  })
  @ApiResponse({
    status: 200,
    description: "Cache refreshed successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Discount cache refreshed successfully",
        },
        version: { type: "number", example: 5 },
      },
    },
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
    status: 500,
    description: "Failed to refresh cache",
  })
  async refreshCache(): Promise<{ message: string; version?: number }> {
    try {
      // Rebuild bundle from database and get the new version number
      const version = await this.rulesetRebuilder.rebuildFromDb();
      return {
        message: "Discount cache refreshed successfully",
        version,
      };
    } catch (_error) {
      // Fallback to invalidation service if direct rebuild fails
      await this.invalidationService.invalidateAll();
      return {
        message:
          "Discount cache refresh triggered (version may not be available)",
      };
    }
  }
}

@ApiTags("store")
@Controller("store/discounts")
export class PublicDiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post("validate")
  @Public()
  @ApiOperation({
    summary: "Validate discount code",
    description:
      "Validate a discount code. Public endpoint for checking if a discount code is valid before applying.",
  })
  @ApiResponse({
    status: 200,
    description: "Discount validation result",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid validation parameters",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Discount code not found",
    type: NotFoundErrorDto,
  })
  @ApiResponse({
    status: 422,
    description: "Unprocessable entity - Discount not applicable (minimum order amount, customer group, etc.)",
    type: BadRequestErrorDto,
  })
  async validateDiscount(
    @Request() req,
    @Body() validateDto: ValidateDiscountDto,
  ) {
    const userId = req.user?.id;
    return this.discountsService.validateDiscount(
      validateDto.code,
      userId,
      validateDto.orderAmount,
    );
  }
}
