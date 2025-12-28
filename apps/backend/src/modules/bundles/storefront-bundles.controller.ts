import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { BundleResponseDto } from "./dto/bundle-response.dto";
import { BundleDefinitionService } from "./services/bundle-definition.service";

@ApiTags("store")
@Controller("store/bundles")
@Public()
export class StorefrontBundlesController {
  constructor(
    private readonly bundleDefinitionService: BundleDefinitionService,
  ) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "List all active bundles with enriched product data",
    description:
      "Retrieve a paginated list of all active bundles with complete product details " +
      "(product IDs, titles, images, SKUs, attributes, pricing) for all variants. " +
      "Public endpoint.",
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
  @ApiOkResponse({
    description: "List of active bundles retrieved successfully",
    type: BundleResponseDto,
    isArray: true,
  })
  async findAll(@Query("page") page?: number, @Query("limit") limit?: number) {
    const result = await this.bundleDefinitionService.findAllActive(
      page || 1,
      limit || 10,
    );
    return result;
  }

  @Get(":id")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get a single bundle with enriched product data",
    description:
      "Retrieve a single active bundle by ID with complete product details " +
      "(product IDs, titles, images, SKUs, attributes, pricing) for all variants. " +
      "No additional API calls needed for display. Public endpoint.",
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "Bundle ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Bundle retrieved successfully",
    type: BundleResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Bundle not found or not active",
  })
  async findOne(@Param("id") id: string): Promise<BundleResponseDto> {
    const bundle = await this.bundleDefinitionService.findOneActive(id);
    return bundle;
  }
}
