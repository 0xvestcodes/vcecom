import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AddBundleSetItemDto } from "./dto/add-bundle-set-item.dto";
import { BundleResponseDto } from "./dto/bundle-response.dto";
import { CreateBundleDto } from "./dto/create-bundle.dto";
import { CreateBundleSetDto } from "./dto/create-bundle-set.dto";
import { UpdateBundleDto } from "./dto/update-bundle.dto";
import { UpdateBundleSetDto } from "./dto/update-bundle-set.dto";
import { BundleDefinitionService } from "./services/bundle-definition.service";
import { BundleSetItemsService } from "./services/bundle-set-items.service";
import { BundleSetsService } from "./services/bundle-sets.service";

@ApiTags("admin")
@Controller("admin/bundles")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class BundlesController {
  constructor(
    private readonly bundleDefinitionService: BundleDefinitionService,
    private readonly bundleSetsService: BundleSetsService,
    private readonly bundleSetItemsService: BundleSetItemsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a new bundle",
    description: "Create a new bundle. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 201,
    description: "Bundle created successfully",
    type: BundleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid bundle data",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async create(
    @Body() createBundleDto: CreateBundleDto,
  ): Promise<BundleResponseDto> {
    return this.bundleDefinitionService.create(createBundleDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all bundles with enriched product data",
    description:
      "Retrieve a paginated list of all bundles with complete product details " +
      "(product IDs, titles, images, SKUs, attributes, pricing) for all variants in bundle sets. " +
      "Admin-only endpoint.",
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
    description: "List of bundles retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findAll(@Query("page") page?: number, @Query("limit") limit?: number) {
    return this.bundleDefinitionService.findAll(page || 1, limit || 10);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get a single bundle with enriched product data",
    description:
      "Retrieve a single bundle with all sets and items, including complete product details " +
      "(product IDs, titles, images, SKUs, attributes, pricing) for all variants. " +
      "No additional API calls needed for display. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Bundle ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Bundle retrieved successfully",
    type: BundleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Bundle not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findOne(@Param("id") id: string): Promise<BundleResponseDto> {
    return this.bundleDefinitionService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update a bundle",
    description: "Update bundle details. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Bundle ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Bundle updated successfully",
    type: BundleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid bundle data",
  })
  @ApiResponse({
    status: 404,
    description: "Bundle not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async update(
    @Param("id") id: string,
    @Body() updateBundleDto: UpdateBundleDto,
  ): Promise<BundleResponseDto> {
    return this.bundleDefinitionService.update(id, updateBundleDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete a bundle",
    description:
      "Delete a bundle (cascades to sets and items). Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Bundle ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Bundle deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Bundle not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async remove(@Param("id") id: string): Promise<{ message: string }> {
    return this.bundleDefinitionService.remove(id);
  }

  @Post(":bundleId/sets")
  @ApiOperation({
    summary: "Create a choice set for a bundle",
    description: "Create a new choice set for a bundle. Admin-only endpoint.",
  })
  @ApiParam({
    name: "bundleId",
    description: "Bundle ID",
    type: String,
  })
  @ApiResponse({
    status: 201,
    description: "Bundle set created successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid set data or max sets exceeded",
  })
  @ApiResponse({
    status: 404,
    description: "Bundle not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async createSet(
    @Param("bundleId") bundleId: string,
    @Body() createBundleSetDto: CreateBundleSetDto,
  ): Promise<{ id: string; message: string }> {
    return this.bundleSetsService.create(bundleId, createBundleSetDto);
  }

  @Patch(":bundleId/sets/:setId")
  @ApiOperation({
    summary: "Update a choice set",
    description: "Update a choice set for a bundle. Admin-only endpoint.",
  })
  @ApiParam({
    name: "bundleId",
    description: "Bundle ID",
    type: String,
  })
  @ApiParam({
    name: "setId",
    description: "Set ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Bundle set updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid set data",
  })
  @ApiResponse({
    status: 404,
    description: "Bundle or set not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async updateSet(
    @Param("bundleId") bundleId: string,
    @Param("setId") setId: string,
    @Body() updateBundleSetDto: UpdateBundleSetDto,
  ): Promise<{ message: string }> {
    return this.bundleSetsService.update(bundleId, setId, updateBundleSetDto);
  }

  @Delete(":bundleId/sets/:setId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete a choice set",
    description:
      "Delete a choice set (cascades to items). Admin-only endpoint.",
  })
  @ApiParam({
    name: "bundleId",
    description: "Bundle ID",
    type: String,
  })
  @ApiParam({
    name: "setId",
    description: "Set ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Bundle set deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Bundle or set not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async removeSet(
    @Param("bundleId") bundleId: string,
    @Param("setId") setId: string,
  ): Promise<{ message: string }> {
    return this.bundleSetsService.remove(bundleId, setId);
  }

  @Post(":bundleId/sets/:setId/items")
  @ApiOperation({
    summary: "Add an item to a choice set",
    description: "Add a product variant to a choice set. Admin-only endpoint.",
  })
  @ApiParam({
    name: "bundleId",
    description: "Bundle ID",
    type: String,
  })
  @ApiParam({
    name: "setId",
    description: "Set ID",
    type: String,
  })
  @ApiResponse({
    status: 201,
    description: "Item added to bundle set successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid variant or duplicate",
  })
  @ApiResponse({
    status: 404,
    description: "Bundle, set, or variant not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async addItem(
    @Param("bundleId") bundleId: string,
    @Param("setId") setId: string,
    @Body() addBundleSetItemDto: AddBundleSetItemDto,
  ): Promise<{ id: string; message: string }> {
    return this.bundleSetItemsService.addItem(
      bundleId,
      setId,
      addBundleSetItemDto,
    );
  }

  @Delete(":bundleId/sets/:setId/items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Remove an item from a choice set",
    description:
      "Remove a product variant from a choice set. Admin-only endpoint.",
  })
  @ApiParam({
    name: "bundleId",
    description: "Bundle ID",
    type: String,
  })
  @ApiParam({
    name: "setId",
    description: "Set ID",
    type: String,
  })
  @ApiParam({
    name: "itemId",
    description: "Item ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Item removed from bundle set successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Cannot remove last item",
  })
  @ApiResponse({
    status: 404,
    description: "Bundle, set, or item not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async removeItem(
    @Param("bundleId") bundleId: string,
    @Param("setId") setId: string,
    @Param("itemId") itemId: string,
  ): Promise<{ message: string }> {
    return this.bundleSetItemsService.removeItem(bundleId, setId, itemId);
  }
}
