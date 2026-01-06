import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { CurrencyService } from "./currency.service";
import { CurrencyResponseDto } from "./dto/currency.dto";

@ApiTags("store")
@Controller("store/currencies")
export class StoreCurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get("active")
  @Public()
  @RateLimit(RATE_LIMIT_PRESETS.PUBLIC_GET)
  @ApiOperation({
    summary: "List active currencies",
    description: "Get a list of only active currencies (public endpoint)",
  })
  @ApiResponse({
    status: 200,
    description: "Active currencies retrieved successfully",
    type: [CurrencyResponseDto],
  })
  async findActive(): Promise<CurrencyResponseDto[]> {
    return this.currencyService.findActive();
  }
}
