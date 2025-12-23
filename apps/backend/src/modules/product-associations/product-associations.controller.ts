import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import {
  AnalysisResponseDto,
  AssociationStatisticsResponseDto,
} from "./dto/product-associations-response.dto";
import { ProductAssociationsService } from "./services/product-associations.service";
import { ProductAssociationsAnalyzer } from "./services/product-associations-analyzer.service";

@ApiTags("admin")
@Controller("admin/product-associations")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class ProductAssociationsController {
  constructor(
    private readonly associationsService: ProductAssociationsService,
    private readonly analyzer: ProductAssociationsAnalyzer,
  ) {}

  @Post("analyze")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Trigger manual analysis",
    description: "Manually trigger product associations analysis",
  })
  @ApiResponse({
    status: 200,
    description: "Analysis triggered successfully",
    type: AnalysisResponseDto,
  })
  async triggerAnalysis(): Promise<AnalysisResponseDto> {
    await this.analyzer.runAnalysis();
    return { message: "Analysis completed successfully" };
  }

  @Get("stats")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get association statistics",
    description: "Get statistics about product associations",
  })
  @ApiResponse({
    status: 200,
    description: "Statistics retrieved successfully",
    type: AssociationStatisticsResponseDto,
  })
  async getStatistics(): Promise<AssociationStatisticsResponseDto> {
    return this.associationsService.getStatistics();
  }
}
