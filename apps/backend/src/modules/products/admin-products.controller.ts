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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { ReviewsService } from "../reviews/services/reviews.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { ProductCollectionResponseDto } from "./dto/product-collection-response.dto";
import { ProductResponseDto } from "./dto/product-response.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { UpdateVariantDto } from "./dto/update-variant.dto";
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

@ApiTags("admin")
@Controller("admin/products")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly variantsService: VariantsService,
    @Inject(forwardRef(() => ReviewsService))
    readonly _reviewsService: ReviewsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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

  @Get(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get product by ID (admin)",
    description: "Retrieve a single product by its ID (admin only)",
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

  @Put(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  async update(
    @Param("id") id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
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
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
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
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @HttpCode(HttpStatus.CREATED)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @HttpCode(HttpStatus.OK)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
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
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @HttpCode(HttpStatus.OK)
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

  @Get(":productId/variants")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all variants for a product (admin)",
    description: "Retrieve all variants for a specific product (admin only)",
  })
  @ApiParam({
    name: "productId",
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
  async getVariants(@Param("productId") productId: string) {
    return this.variantsService.findByProductId(productId);
  }

  @Get(":productId/variants/:variantId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get variant by ID (admin)",
    description: "Retrieve a single variant by its ID (admin only)",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "variantId",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant retrieved successfully",
    type: VariantResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Variant not found",
  })
  async getVariant(@Param("variantId") variantId: string) {
    return this.variantsService.findOne(variantId);
  }

  @Post(":productId/variants")
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Create a new product variant",
    description: "Create a new variant for a product (admin only)",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "Variant created successfully",
    type: VariantResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or product not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async createVariant(
    @Param("productId") productId: string,
    @Body() createVariantDto: CreateVariantDto,
  ): Promise<VariantResponseDto> {
    createVariantDto.productId = productId;
    return this.variantsService.create(createVariantDto);
  }

  @Put(":productId/variants/:variantId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Update a product variant",
    description: "Update an existing variant (admin only)",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "variantId",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant updated successfully",
    type: VariantResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Variant not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input or SKU already exists",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async updateVariant(
    @Param("variantId") variantId: string,
    @Body() updateVariantDto: UpdateVariantDto,
  ): Promise<VariantResponseDto> {
    return this.variantsService.update(variantId, updateVariantDto);
  }

  @Delete(":productId/variants/:variantId")
  @HttpCode(HttpStatus.OK)
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Delete a product variant",
    description:
      "Delete a variant (admin only). Variant images will be cascade deleted.",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "variantId",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Variant deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Variant not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async removeVariant(@Param("variantId") variantId: string) {
    return this.variantsService.remove(variantId);
  }

  @Get(":productId/variants/:variantId/images")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get variant images",
    description:
      "Get all images for a variant with resolved URLs. Admin-only endpoint.",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "variantId",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant images",
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
  @ApiNotFoundResponse({ description: "Variant not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin role required" })
  async getVariantImages(
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
  ) {
    return this.productsService.getVariantImages(productId, variantId);
  }
}
