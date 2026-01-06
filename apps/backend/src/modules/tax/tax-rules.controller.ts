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
  CreateTaxRuleDto,
  TaxRuleResponseDto,
  UpdateTaxRuleDto,
} from "./dto/tax-rules.dto";
import { TaxRulesService } from "./services/tax-rules.service";

@ApiTags("admin")
@Controller("admin/tax-rules")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class TaxRulesController {
  constructor(private readonly taxRulesService: TaxRulesService) {}

  @Post()
  @ApiOperation({ summary: "Create a new tax rule (admin)" })
  @ApiResponse({
    status: 201,
    description: "Tax rule created successfully",
    type: TaxRuleResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async create(
    @Body() createDto: CreateTaxRuleDto,
  ): Promise<TaxRuleResponseDto> {
    return this.taxRulesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all tax rules (admin)" })
  @ApiResponse({
    status: 200,
    description: "Tax rules retrieved successfully",
    type: [TaxRuleResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findAll(): Promise<TaxRuleResponseDto[]> {
    return this.taxRulesService.findAll();
  }

  @Get("active")
  @ApiOperation({ summary: "Get active tax rules (admin)" })
  @ApiResponse({
    status: 200,
    description: "Active tax rules retrieved successfully",
    type: [TaxRuleResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findActive(): Promise<TaxRuleResponseDto[]> {
    return this.taxRulesService.findActive();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get tax rule by ID (admin)" })
  @ApiParam({ name: "id", description: "Tax rule ID" })
  @ApiResponse({
    status: 200,
    description: "Tax rule retrieved successfully",
    type: TaxRuleResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "Tax rule not found" })
  async findOne(@Param("id") id: string): Promise<TaxRuleResponseDto> {
    return this.taxRulesService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update tax rule (admin)" })
  @ApiParam({ name: "id", description: "Tax rule ID" })
  @ApiResponse({
    status: 200,
    description: "Tax rule updated successfully",
    type: TaxRuleResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "Tax rule not found" })
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateTaxRuleDto,
  ): Promise<TaxRuleResponseDto> {
    return this.taxRulesService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete tax rule (admin)" })
  @ApiParam({ name: "id", description: "Tax rule ID" })
  @ApiResponse({
    status: 200,
    description: "Tax rule deleted successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "Tax rule not found" })
  async remove(@Param("id") id: string): Promise<{ message: string }> {
    return this.taxRulesService.remove(id);
  }
}
