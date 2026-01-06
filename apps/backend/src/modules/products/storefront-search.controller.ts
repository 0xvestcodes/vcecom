import { Controller, Get, Optional, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { SearchQueryService } from "../search/search-query.service";
import { QueryProductsDto } from "./dto/query-products.dto";
import { ProductsService } from "./products.service";

@ApiTags("store")
@Controller("store/search")
@Public()
export class StorefrontSearchController {
  constructor(
    private readonly productsService: ProductsService,
    @Optional() private readonly searchQueryService?: SearchQueryService,
  ) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Unified search endpoint",
    description:
      "Search for products with query string. Supports full-text search in title, description, and SKU.",
  })
  @ApiQuery({
    name: "q",
    required: true,
    type: String,
    description: "Search query",
    example: "wireless headphones",
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
    description: "Items per page (default: 20, max: 50)",
  })
  @ApiOkResponse({
    description: "Search results retrieved successfully",
  })
  async search(
    @Query("q") query: string,
    @Query() pagination: QueryProductsDto,
  ) {
    if (!query) {
      return {
        data: [],
        total: 0,
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    // Try indexed search first if available
    if (this.searchQueryService) {
      try {
        const indexedResults = await this.searchQueryService.searchProducts(
          query,
          {
            page: pagination.page,
            limit: pagination.limit,
            status: "active",
          },
        );

        // Transform to ProductsService format
        return {
          data: indexedResults.results.map((result) => ({
            id: result.document.id,
            title: result.document.title,
            description: result.document.description,
            price: result.document.price,
            status: result.document.status,
            categoryId: result.document.categoryId,
            slug: result.document.slug,
            imageUrl: result.document.imageUrl,
            // Add other required fields
            gstRate: 0,
            pricingType: "exclusive" as const,
            isDigital: result.document.isDigital,
            isPreorder: result.document.isPreorder,
            createdAt: new Date(result.document.createdAt),
            updatedAt: new Date(result.document.updatedAt),
          })),
          total: indexedResults.total,
          page: indexedResults.page,
          limit: indexedResults.limit,
          totalPages: indexedResults.totalPages,
          hasNextPage: indexedResults.page < indexedResults.totalPages,
          hasPreviousPage: indexedResults.page > 1,
        };
      } catch (_error) {
        // Fall through to database search
      }
    }

    // Fallback to database search
    return this.productsService.findAll({
      ...pagination,
      search: query,
    });
  }
}
