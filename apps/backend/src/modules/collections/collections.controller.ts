import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaginatedResponseDto } from "../../common/dto/pagination.dto";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { CollectionsService } from "./collections.service";
import { AddProductsDto } from "./dto/add-products.dto";
import { CollectionResponseDto } from "./dto/collection-response.dto";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { QueryCollectionsDto } from "./dto/query-collections.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@ApiTags("admin")
@Controller("admin/collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get all collections",
    description:
      "Retrieve a paginated list of collections with search (admin only)",
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
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search query (searches in name and description)",
  })
  @ApiOkResponse({
    description: "List of collections retrieved successfully",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async findAll(
    @Query() query: QueryCollectionsDto,
  ): Promise<PaginatedResponseDto<CollectionResponseDto>> {
    return this.collectionsService.findAll(query);
  }

  @Get(":id")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get collection by ID",
    description: "Retrieve a single collection by its ID (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Collection ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Collection retrieved successfully",
    type: CollectionResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Collection not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async findOne(@Param("id") id: string): Promise<CollectionResponseDto> {
    return this.collectionsService.findOne(id);
  }

  @Post()
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create a new collection",
    description: "Create a new collection (admin only)",
  })
  @ApiOkResponse({
    description: "Collection created successfully",
    type: CollectionResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async create(
    @Body() createCollectionDto: CreateCollectionDto,
  ): Promise<CollectionResponseDto> {
    return this.collectionsService.create(createCollectionDto);
  }

  @Put(":id")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update a collection",
    description: "Update an existing collection (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Collection ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Collection updated successfully",
    type: CollectionResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Collection not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async update(
    @Param("id") id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ): Promise<CollectionResponseDto> {
    return this.collectionsService.update(id, updateCollectionDto);
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete a collection",
    description:
      "Delete a collection (admin only). Product associations will be cascade deleted.",
  })
  @ApiParam({
    name: "id",
    description: "Collection ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Collection deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Collection deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Collection not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async remove(@Param("id") id: string): Promise<void> {
    return this.collectionsService.remove(id);
  }

  @Get(":id/products")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get products in collection",
    description: "Get all products that belong to a collection (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Collection ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Products retrieved successfully",
  })
  @ApiNotFoundResponse({
    description: "Collection not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async getProducts(@Param("id") id: string): Promise<
    Array<{
      id: string;
      title: string;
      price: number;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    return this.collectionsService.getProducts(id);
  }

  @Post(":id/products")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Add products to collection",
    description: "Add one or more products to a collection (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Collection ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Products added successfully",
  })
  @ApiNotFoundResponse({
    description: "Collection not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input or products not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async addProducts(
    @Param("id") id: string,
    @Body() addProductsDto: AddProductsDto,
  ) {
    return this.collectionsService.addProducts(id, addProductsDto);
  }

  @Delete(":id/products/:productId")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Remove product from collection",
    description: "Remove a product from a collection (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Collection ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "223e4567-e89b-12d3-a456-426614174001",
  })
  @ApiOkResponse({
    description: "Product removed successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Product removed from collection successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Collection or product not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async removeProduct(
    @Param("id") id: string,
    @Param("productId") productId: string,
  ) {
    return this.collectionsService.removeProduct(id, productId);
  }

  @Get(":id/preview")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Preview automatic collection",
    description:
      "Get count of products that would match an automatic collection's rules (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Collection ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Preview count retrieved successfully",
    schema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          example: 42,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Collection not found",
  })
  @ApiBadRequestResponse({
    description: "Collection is not automatic or has no rules",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async preview(@Param("id") id: string): Promise<{ count: number }> {
    return this.collectionsService.preview(id);
  }
}
