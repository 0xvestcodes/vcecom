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
  CreateHsnCodeDto,
  HsnCodeResponseDto,
  UpdateHsnCodeDto,
} from "./dto/hsn-codes.dto";
import { HsnManagementService } from "./services/hsn-management.service";

@ApiTags("admin")
@Controller("admin/hsn-codes")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class HsnCodesController {
  constructor(private readonly hsnManagementService: HsnManagementService) {}

  @Post()
  @ApiOperation({ summary: "Create a new HSN code (admin)" })
  @ApiResponse({
    status: 201,
    description: "HSN code created successfully",
    type: HsnCodeResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async create(
    @Body() createDto: CreateHsnCodeDto,
  ): Promise<HsnCodeResponseDto> {
    const hsn = await this.hsnManagementService.create({
      hsnCode: createDto.hsnCode,
      description: createDto.description,
      gstRate: createDto.gstRate,
    });
    return {
      id: hsn.id,
      hsnCode: hsn.hsnCode,
      description: hsn.description,
      gstRate: hsn.gstRate ? Number(hsn.gstRate) : null,
      isActive: hsn.isActive === 1,
      createdAt: hsn.createdAt,
      updatedAt: hsn.updatedAt,
    };
  }

  @Get()
  @ApiOperation({ summary: "Get all HSN codes (admin)" })
  @ApiResponse({
    status: 200,
    description: "HSN codes retrieved successfully",
    type: [HsnCodeResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findAll(): Promise<HsnCodeResponseDto[]> {
    const hsnCodes = await this.hsnManagementService.findAll();
    return hsnCodes.map((hsn) => ({
      id: hsn.id,
      hsnCode: hsn.hsnCode,
      description: hsn.description,
      gstRate: hsn.gstRate ? Number(hsn.gstRate) : null,
      isActive: hsn.isActive === 1,
      createdAt: hsn.createdAt,
      updatedAt: hsn.updatedAt,
    }));
  }

  @Get("active")
  @ApiOperation({ summary: "Get active HSN codes (admin)" })
  @ApiResponse({
    status: 200,
    description: "Active HSN codes retrieved successfully",
    type: [HsnCodeResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findActive(): Promise<HsnCodeResponseDto[]> {
    const hsnCodes = await this.hsnManagementService.findActive();
    return hsnCodes.map((hsn) => ({
      id: hsn.id,
      hsnCode: hsn.hsnCode,
      description: hsn.description,
      gstRate: hsn.gstRate ? Number(hsn.gstRate) : null,
      isActive: hsn.isActive === 1,
      createdAt: hsn.createdAt,
      updatedAt: hsn.updatedAt,
    }));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get HSN code by ID (admin)" })
  @ApiParam({ name: "id", description: "HSN code ID" })
  @ApiResponse({
    status: 200,
    description: "HSN code retrieved successfully",
    type: HsnCodeResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "HSN code not found" })
  async findOne(@Param("id") id: string): Promise<HsnCodeResponseDto> {
    const hsn = await this.hsnManagementService.findOne(id);
    return {
      id: hsn.id,
      hsnCode: hsn.hsnCode,
      description: hsn.description,
      gstRate: hsn.gstRate ? Number(hsn.gstRate) : null,
      isActive: hsn.isActive === 1,
      createdAt: hsn.createdAt,
      updatedAt: hsn.updatedAt,
    };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update HSN code (admin)" })
  @ApiParam({ name: "id", description: "HSN code ID" })
  @ApiResponse({
    status: 200,
    description: "HSN code updated successfully",
    type: HsnCodeResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "HSN code not found" })
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateHsnCodeDto,
  ): Promise<HsnCodeResponseDto> {
    const hsn = await this.hsnManagementService.update(id, {
      description: updateDto.description,
      gstRate: updateDto.gstRate,
      isActive: updateDto.isActive,
    });
    return {
      id: hsn.id,
      hsnCode: hsn.hsnCode,
      description: hsn.description,
      gstRate: hsn.gstRate ? Number(hsn.gstRate) : null,
      isActive: hsn.isActive === 1,
      createdAt: hsn.createdAt,
      updatedAt: hsn.updatedAt,
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete HSN code (admin)" })
  @ApiParam({ name: "id", description: "HSN code ID" })
  @ApiResponse({
    status: 200,
    description: "HSN code deleted successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({ status: 404, description: "HSN code not found" })
  async remove(@Param("id") id: string): Promise<{ message: string }> {
    return this.hsnManagementService.remove(id);
  }
}
