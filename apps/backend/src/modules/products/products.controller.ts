import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request as ExpressRequest } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from "../../common/dto/error-response.dto";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { ReviewQueryDto } from "../reviews/dto/review-query.dto";
import { PaginatedReviewsResponseDto } from "../reviews/dto/review-response.dto";
import { ReviewsService } from "../reviews/services/reviews.service";
import { ProductCollectionResponseDto } from "./dto/product-collection-response.dto";

interface AuthenticatedRequest extends ExpressRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

import { CreateProductDto } from "./dto/create-product.dto";
import { FilterProductsDto } from "./dto/filter.dto";
import {
  PaginatedProductsResponseDto,
  ProductResponseDto,
} from "./dto/product-response.dto";
import { QueryProductsDto } from "./dto/query-products.dto";
import { SearchProductsDto, SearchResponseDto } from "./dto/search.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateProductVariantOptionTypeDto } from "./dto/variant-option-types/create-product-variant-option-type.dto";
import { CreateVariantOptionTypeDto } from "./dto/variant-option-types/create-variant-option-type.dto";
import { CreateVariantOptionValueDto } from "./dto/variant-option-types/create-variant-option-value.dto";
import {
  ProductVariantOptionTypeResponseDto,
  VariantOptionTypeResponseDto,
} from "./dto/variant-option-types/variant-option-type-response.dto";
import { VariantResponseDto } from "./dto/variant-response.dto";
import { ProductsService } from "./products.service";
import { VariantsService } from "./variants.service";

@ApiTags("store")
@Controller("store/products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly variantsService: VariantsService,
    @Inject(forwardRef(() => ReviewsService))
    private readonly reviewsService: ReviewsService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  @Public()
  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get all products with search and filters",
    description:
      "Retrieve a paginated list of products with search, filters, and sorting (public endpoint). Supports full-text search in title, description, and SKU.",
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
  @ApiOkResponse({
    description: "List of products retrieved successfully",
    type: PaginatedProductsResponseDto,
  })
  async findAll(
    @Query() query: QueryProductsDto,
  ): Promise<PaginatedProductsResponseDto> {
    return this.productsService.findAll(query);
  }

  @Public()
  @Post("search")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.CATEGORIES_SEARCH)
  @ApiOperation({
    summary: "Advanced product search with ranking",
    description:
      "Perform advanced product search with full-text search, SKU search, fuzzy matching, and relevance ranking. Uses fuse.js for intelligent search matching.",
  })
  @ApiOkResponse({
    description: "Search results with relevance scores",
    type: SearchResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid search query or parameters",
  })
  async search(
    @Body() searchDto: SearchProductsDto,
  ): Promise<SearchResponseDto> {
    return this.productsService.search(searchDto);
  }

  @Public()
  @Post("filter")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.CATEGORIES_SEARCH)
  @ApiOperation({
    summary: "Filter and sort products",
    description:
      "Filter products by category, price range, availability, and status. Sort by price, name, or date. All filters can be combined.",
  })
  @ApiOkResponse({
    description: "Filtered and sorted products",
    type: PaginatedProductsResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid filter parameters",
  })
  async filter(
    @Body() filterDto: FilterProductsDto,
  ): Promise<PaginatedProductsResponseDto> {
    return this.productsService.filter(filterDto);
  }

  @Public()
  @Get(":id")
  @RateLimit(RATE_LIMIT_PRESETS.PRODUCT_DETAIL)
  @ApiOperation({
    summary: "Get product by ID",
    description: "Retrieve a single product by its ID (public endpoint)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Product retrieved successfully",
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  async findOne(@Param("id") id: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  @Public()
  @Get(":id/variants")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get all variants for a product",
    description:
      "Retrieve all variants for a specific product (public endpoint)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "List of variants retrieved successfully",
    type: [VariantResponseDto],
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  async getVariants(
    @Param("id") productId: string,
  ): Promise<VariantResponseDto[]> {
    return this.variantsService.findByProductId(productId);
  }

  @Public()
  @Get(":id/reviews")
  @RateLimit(RATE_LIMIT_PRESETS.REVIEWS_LISTING)
  @ApiOperation({
    summary: "Get reviews for a product",
    description:
      "Retrieve paginated reviews for a product. Supports filtering and sorting. Public endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Reviews retrieved successfully",
    type: PaginatedReviewsResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  async getReviews(
    @Param("id") productId: string,
    @Query() query: ReviewQueryDto,
    @Request() req?: AuthenticatedRequest,
  ): Promise<PaginatedReviewsResponseDto> {
    // Get first variant of product for reviews (reviews are variant-specific)
    const variants = await this.variantsService.findByProductId(productId);
    if (variants.length === 0) {
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
    // Get customer ID if authenticated
    let customerId: string | undefined;
    if (req?.user?.userId) {
      const { customers, eq } = await import("@vcecom/db");
      const [customer] = await this.db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.userId, req.user.userId))
        .limit(1);
      customerId = customer?.id;
    }
    // Return reviews for the first variant
    // In a real implementation, you might want to aggregate reviews across all variants
    return this.reviewsService.findByVariant(
      variants[0].id,
      query || {},
      customerId,
    );
  }

  @Public()
  @Get(":id/recommendations")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get product recommendations",
    description:
      "Get recommended products based on the current product (same category, etc.)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Recommended products retrieved successfully",
    type: [ProductResponseDto],
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  async getRecommendations(
    @Param("id") id: string,
  ): Promise<ProductResponseDto[]> {
    return this.productsService.getRecommendations(id);
  }

  @Post()
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create a new product",
    description: "Create a new product (admin only)",
  })
  @ApiCreatedResponse({
    description: "Product created successfully",
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or category not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async create(
    @Body() createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(createProductDto);
  }

  @Put(":id")
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update a product",
    description: "Update an existing product (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Product updated successfully",
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Product not found",
    type: NotFoundErrorDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or category not found",
    type: BadRequestErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
    type: UnauthorizedErrorDto,
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
    type: ForbiddenErrorDto,
  })
  @ApiConflictResponse({
    description: "Conflict - Product update conflicts with existing data",
    type: ConflictErrorDto,
  })
  async update(
    @Param("id") id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete a product",
    description:
      "Delete a product (admin only). Variants and images will be cascade deleted.",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Product deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Product deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }

  @Get(":id/collections")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get collections for a product",
    description: "Get all collections that contain this product (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Collections retrieved successfully",
    type: [ProductCollectionResponseDto],
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async getProductCollections(
    @Param("id") id: string,
  ): Promise<ProductCollectionResponseDto[]> {
    return this.productsService.getProductCollections(id);
  }

  @Get("variant-option-types")
  @ApiOperation({
    summary: "Get all global variant option type templates",
    description: "Get all reusable variant option type templates",
  })
  @ApiOkResponse({
    description: "Variant option types retrieved successfully",
    type: [VariantOptionTypeResponseDto],
  })
  async getVariantOptionTypes() {
    return this.productsService.getVariantOptionTypes();
  }

  @Post("variant-option-types")
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create a global variant option type template",
    description: "Create a reusable variant option type template (admin only)",
  })
  @ApiCreatedResponse({
    description: "Variant option type created successfully",
    type: VariantOptionTypeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async createVariantOptionType(@Body() createDto: CreateVariantOptionTypeDto) {
    return this.productsService.createVariantOptionType(
      createDto.name,
      createDto.description,
    );
  }

  @Get(":id/variant-option-types")
  @ApiOperation({
    summary: "Get product variant option types",
    description: "Get all variant option types for a product with their values",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Product variant option types retrieved successfully",
    type: [ProductVariantOptionTypeResponseDto],
  })
  async getProductVariantOptionTypes(@Param("id") id: string) {
    return this.productsService.getProductVariantOptionTypes(id);
  }

  @Post(":id/variant-option-types")
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Add variant option type to product",
    description: "Add a variant option type to a product (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "Variant option type added successfully",
    type: ProductVariantOptionTypeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async addVariantOptionTypeToProduct(
    @Param("id") productId: string,
    @Body() createDto: CreateProductVariantOptionTypeDto,
  ) {
    return this.productsService.addVariantOptionTypeToProduct(
      productId,
      createDto.optionTypeId,
      createDto.name,
      createDto.displayOrder,
    );
  }

  @Delete(":id/variant-option-types/:optionTypeId")
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Remove variant option type from product",
    description: "Remove a variant option type from a product (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "optionTypeId",
    description: "Product variant option type ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant option type removed successfully",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async removeVariantOptionTypeFromProduct(
    @Param("id") productId: string,
    @Param("optionTypeId") optionTypeId: string,
  ) {
    return this.productsService.removeVariantOptionTypeFromProduct(
      productId,
      optionTypeId,
    );
  }

  @Post(":id/variant-option-types/:optionTypeId/values")
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Add value to variant option type",
    description: "Add a value to a product variant option type (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "optionTypeId",
    description: "Product variant option type ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "Variant option value added successfully",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async addValueToVariantOptionType(
    @Param("optionTypeId") optionTypeId: string,
    @Body() createDto: CreateVariantOptionValueDto,
  ) {
    return this.productsService.addValueToVariantOptionType(
      optionTypeId,
      createDto.value,
      createDto.displayOrder,
    );
  }

  @Delete(":id/variant-option-types/:optionTypeId/values/:valueId")
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Remove value from variant option type",
    description:
      "Remove a value from a product variant option type (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "optionTypeId",
    description: "Product variant option type ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "valueId",
    description: "Variant option value ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant option value removed successfully",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async removeValueFromVariantOptionType(
    @Param("optionTypeId") optionTypeId: string,
    @Param("valueId") valueId: string,
  ) {
    return this.productsService.removeValueFromVariantOptionType(
      optionTypeId,
      valueId,
    );
  }

  @Get(":id/images")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get product images",
    description:
      "Get all images for a product with resolved URLs. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Product images",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          variantId: { type: "string", nullable: true },
          url: { type: "string" },
          altText: { type: "string", nullable: true },
          order: { type: "number" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: "Product not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async getProductImages(@Param("id") id: string) {
    return this.productsService.getProductImages(id);
  }

  @Post(":id/images")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Add product image",
    description:
      "Add an image to a product using S3 key or URL. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        imageKey: {
          type: "string",
          description:
            "S3 key (e.g., 'products/20251216-abc123.webp') or full URL",
          example: "products/20251216-abc123.webp",
        },
        altText: {
          type: "string",
          description: "Alt text for the image",
          example: "Product image",
        },
        order: {
          type: "number",
          description: "Display order",
          example: 0,
        },
        variantId: {
          type: "string",
          description: "Optional variant ID",
          example: "123e4567-e89b-12d3-a456-426614174001",
        },
      },
      required: ["imageKey"],
    },
  })
  @ApiOkResponse({
    description: "Image added successfully",
  })
  @ApiNotFoundResponse({ description: "Product or variant not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async addProductImage(
    @Param("id") id: string,
    @Body() body: {
      imageKey: string;
      altText?: string;
      order?: number;
      variantId?: string;
    },
  ) {
    return this.productsService.addProductImage(
      id,
      body.imageKey,
      body.altText,
      body.order,
      body.variantId,
    );
  }

  @Delete("images/:imageId")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete product image",
    description:
      "Delete a product image. Also deletes from S3 if it's an S3 key. Admin-only endpoint.",
  })
  @ApiParam({
    name: "imageId",
    description: "Image ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Image deleted successfully",
  })
  @ApiNotFoundResponse({ description: "Image not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async deleteProductImage(@Param("imageId") imageId: string) {
    return this.productsService.deleteProductImage(imageId);
  }

  @Put("images/:imageId/order")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update image order",
    description:
      "Update the display order of a product image. Admin-only endpoint.",
  })
  @ApiParam({
    name: "imageId",
    description: "Image ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        order: {
          type: "number",
          description: "Display order",
          example: 0,
        },
      },
      required: ["order"],
    },
  })
  @ApiOkResponse({
    description: "Image order updated successfully",
  })
  @ApiNotFoundResponse({ description: "Image not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async updateImageOrder(
    @Param("imageId") imageId: string,
    @Body() body: { order: number },
  ) {
    return this.productsService.updateImageOrder(imageId, body.order);
  }

  @Patch("images/:imageId")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update product image",
    description:
      "Update alt text and/or order of a product image. Admin-only endpoint.",
  })
  @ApiParam({
    name: "imageId",
    description: "Image ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        altText: {
          type: "string",
          description: "Alt text for the image",
          example: "Product image",
          nullable: true,
        },
        order: {
          type: "number",
          description: "Display order",
          example: 0,
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Image updated successfully",
  })
  @ApiNotFoundResponse({ description: "Image not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async updateImage(
    @Param("imageId") imageId: string,
    @Body() body: { altText?: string; order?: number },
  ) {
    return this.productsService.updateImage(imageId, body.altText, body.order);
  }

  @Put("images/:imageId/replace")
  @Roles("admin")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Replace product image",
    description:
      "Replace a product image with a new one. Old S3 file is deleted. Admin-only endpoint.",
  })
  @ApiParam({
    name: "imageId",
    description: "Image ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        imageKey: {
          type: "string",
          description:
            "S3 key (e.g., 'products/20251216-abc123.webp') or full URL",
          example: "products/20251216-abc123.webp",
        },
      },
      required: ["imageKey"],
    },
  })
  @ApiOkResponse({
    description: "Image replaced successfully",
  })
  @ApiNotFoundResponse({ description: "Image not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async replaceImage(
    @Param("imageId") imageId: string,
    @Body() body: { imageKey: string },
  ) {
    return this.productsService.replaceProductImage(imageId, body.imageKey);
  }
}
