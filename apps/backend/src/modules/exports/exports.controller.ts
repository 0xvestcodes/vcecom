import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import {
  ExportCustomersDto,
  ExportInventoryDto,
  ExportOrdersDto,
  ExportProductsDto,
  ExportResponseDto,
} from "./dto/exports.dto";
import { ExportsService } from "./exports.service";

@ApiTags("admin")
@Controller("admin/exports")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin", "support", "reviewer", "marketing")
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post("orders")
  @RateLimit(RATE_LIMIT_PRESETS.EXPORT)
  @ApiOperation({
    summary: "Export orders (admin)",
    description:
      "Export orders in CSV, PDF, or ZIP format. Returns a signed URL for download.",
  })
  @ApiResponse({
    status: 201,
    description: "Export created successfully",
    type: ExportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async exportOrders(@Body() dto: ExportOrdersDto): Promise<ExportResponseDto> {
    return this.exportsService.exportOrders(dto);
  }

  @Post("products")
  @RateLimit(RATE_LIMIT_PRESETS.EXPORT)
  @ApiOperation({
    summary: "Export products (admin)",
    description: "Export products in CSV, PDF, or ZIP format.",
  })
  @ApiResponse({
    status: 201,
    description: "Export created successfully",
    type: ExportResponseDto,
  })
  async exportProducts(
    @Body() dto: ExportProductsDto,
  ): Promise<ExportResponseDto> {
    return this.exportsService.exportProducts(dto);
  }

  @Post("customers")
  @RateLimit(RATE_LIMIT_PRESETS.EXPORT)
  @ApiOperation({
    summary: "Export customers (admin)",
    description: "Export customers in CSV, PDF, or ZIP format.",
  })
  @ApiResponse({
    status: 201,
    description: "Export created successfully",
    type: ExportResponseDto,
  })
  async exportCustomers(
    @Body() dto: ExportCustomersDto,
  ): Promise<ExportResponseDto> {
    return this.exportsService.exportCustomers(dto);
  }

  @Post("inventory")
  @RateLimit(RATE_LIMIT_PRESETS.EXPORT)
  @ApiOperation({
    summary: "Export inventory (admin)",
    description: "Export inventory in CSV, PDF, or ZIP format.",
  })
  @ApiResponse({
    status: 201,
    description: "Export created successfully",
    type: ExportResponseDto,
  })
  async exportInventory(
    @Body() dto: ExportInventoryDto,
  ): Promise<ExportResponseDto> {
    return this.exportsService.exportInventory(dto);
  }
}
