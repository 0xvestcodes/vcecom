import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { FrequentlyBoughtTogetherResponseDto } from "./dto/product-associations-response.dto";
import { ProductAssociationsService } from "./services/product-associations.service";

@ApiTags("store")
@Controller("store/products")
@Public()
export class StorefrontProductAssociationsController {
  constructor(
    private readonly associationsService: ProductAssociationsService,
  ) {}

  @Get(":id/frequently-bought-together")
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get frequently bought together products",
    description:
      "Returns products that are frequently bought together with the given product",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "limit",
    description: "Maximum number of products to return",
    example: 4,
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: "Frequently bought together products",
    type: FrequentlyBoughtTogetherResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Product not found",
  })
  async getFrequentlyBoughtTogether(
    @Param("id") productId: string,
    @Query("limit") limit?: number,
  ): Promise<FrequentlyBoughtTogetherResponseDto> {
    const associations =
      await this.associationsService.getFrequentlyBoughtTogether(
        productId,
        limit || 4,
      );
    return {
      productId,
      associations: associations.map((a) => ({
        productId: a.productId,
        confidenceScore: a.confidenceScore,
      })),
    };
  }
}
