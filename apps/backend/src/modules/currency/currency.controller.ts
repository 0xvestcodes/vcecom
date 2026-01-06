import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
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
import { CurrencyService } from "./currency.service";
import {
  CreateCurrencyDto,
  CurrencyResponseDto,
  UpdateCurrencyDto,
} from "./dto/currency.dto";

@ApiTags("admin")
@Controller("admin/currencies")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "List all currencies",
    description: "Get a list of all currencies (active and inactive)",
  })
  @ApiResponse({
    status: 200,
    description: "Currencies retrieved successfully",
    type: [CurrencyResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findAll(): Promise<CurrencyResponseDto[]> {
    return this.currencyService.findAll();
  }

  @Get("active")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "List active currencies",
    description: "Get a list of only active currencies",
  })
  @ApiResponse({
    status: 200,
    description: "Active currencies retrieved successfully",
    type: [CurrencyResponseDto],
  })
  async findActive(): Promise<CurrencyResponseDto[]> {
    return this.currencyService.findActive();
  }

  @Get("default")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get default currency",
    description: "Get the default currency",
  })
  @ApiResponse({
    status: 200,
    description: "Default currency retrieved successfully",
    type: CurrencyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "No default currency found",
  })
  async findDefault(): Promise<CurrencyResponseDto | null> {
    return this.currencyService.findDefault();
  }

  @Get(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get currency by ID",
    description: "Get a specific currency by its ID",
  })
  @ApiResponse({
    status: 200,
    description: "Currency retrieved successfully",
    type: CurrencyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Currency not found",
  })
  async findOne(@Param("id") id: string): Promise<CurrencyResponseDto | null> {
    return this.currencyService.findOne(id);
  }

  @Post()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Create currency",
    description: "Create a new currency",
  })
  @ApiResponse({
    status: 201,
    description: "Currency created successfully",
    type: CurrencyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid currency data",
  })
  async create(@Body() dto: CreateCurrencyDto): Promise<CurrencyResponseDto> {
    return this.currencyService.create(dto);
  }

  @Patch(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update currency",
    description: "Update an existing currency",
  })
  @ApiResponse({
    status: 200,
    description: "Currency updated successfully",
    type: CurrencyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Currency not found",
  })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCurrencyDto,
  ): Promise<CurrencyResponseDto> {
    return this.currencyService.update(id, dto);
  }

  @Delete(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Delete currency",
    description: "Delete a currency (cannot delete default currency)",
  })
  @ApiResponse({
    status: 200,
    description: "Currency deleted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Cannot delete default currency",
  })
  @ApiResponse({
    status: 404,
    description: "Currency not found",
  })
  async delete(@Param("id") id: string): Promise<void> {
    return this.currencyService.delete(id);
  }

  @Post(":id/set-default")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Set default currency",
    description: "Set a currency as the default currency",
  })
  @ApiResponse({
    status: 200,
    description: "Default currency set successfully",
    type: CurrencyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Currency not found",
  })
  async setDefault(@Param("id") id: string): Promise<CurrencyResponseDto> {
    return this.currencyService.setDefault(id);
  }
}
