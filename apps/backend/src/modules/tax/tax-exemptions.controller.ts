import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  CreateTaxExemptionDto,
  TaxExemptionResponseDto,
  UpdateTaxExemptionDto,
} from "./dto/tax-exemptions.dto";
import { TaxExemptionsService } from "./services/tax-exemptions.service";

@ApiTags("admin")
@Controller("admin/tax-exemptions")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class TaxExemptionsController {
  constructor(private readonly taxExemptionsService: TaxExemptionsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new tax exemption (admin)" })
  @ApiResponse({
    status: 201,
    description: "Tax exemption created successfully",
    type: TaxExemptionResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async create(
    @Body() createDto: CreateTaxExemptionDto,
  ): Promise<TaxExemptionResponseDto> {
    return this.taxExemptionsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all tax exemptions (admin)" })
  @ApiResponse({
    status: 200,
    description: "Tax exemptions retrieved successfully",
    type: [TaxExemptionResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findAll(): Promise<TaxExemptionResponseDto[]> {
    return this.taxExemptionsService.findAll();
  }

  @Get("active")
  @ApiOperation({ summary: "Get active tax exemptions (admin)" })
  @ApiResponse({
    status: 200,
    description: "Active tax exemptions retrieved successfully",
    type: [TaxExemptionResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findActive(): Promise<TaxExemptionResponseDto[]> {
    return this.taxExemptionsService.findActive();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get tax exemption by ID (admin)" })
  @ApiParam({ name: "id", description: "Tax exemption ID" })
  @ApiResponse({
    status: 200,
    description: "Tax exemption retrieved successfully",
    type: TaxExemptionResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "Tax exemption not found" })
  async findOne(@Param("id") id: string): Promise<TaxExemptionResponseDto> {
    return this.taxExemptionsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update tax exemption (admin)" })
  @ApiParam({ name: "id", description: "Tax exemption ID" })
  @ApiResponse({
    status: 200,
    description: "Tax exemption updated successfully",
    type: TaxExemptionResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "Tax exemption not found" })
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateTaxExemptionDto,
  ): Promise<TaxExemptionResponseDto> {
    return this.taxExemptionsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete tax exemption (admin)" })
  @ApiParam({ name: "id", description: "Tax exemption ID" })
  @ApiResponse({
    status: 200,
    description: "Tax exemption deleted successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "Tax exemption not found" })
  async remove(@Param("id") id: string): Promise<{ message: string }> {
    return this.taxExemptionsService.remove(id);
  }
}
