import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { PriceListResponseDto } from "./dto/price-list-response.dto";
import { PriceListService } from "./services/price-list.service";

@ApiTags("store")
@Controller("store/price-lists")
@Public()
export class StorefrontPriceListsController {
  constructor(private readonly priceListService: PriceListService) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.STOREFRONT_GET)
  @ApiOperation({
    summary: "Get all active price lists",
    description:
      "Retrieve a list of all active price lists (public endpoint). Price lists can be used to show different pricing tiers.",
  })
  @ApiOkResponse({
    description: "Active price lists retrieved successfully",
    type: [PriceListResponseDto],
  })
  async findAll(): Promise<PriceListResponseDto[]> {
    return this.priceListService.findActive();
  }
}
