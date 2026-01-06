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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { geoRules, regionPricingRules } from "@vcecom/db";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ContextService } from "../../common/logging/context.service";
import { GeoLocationDto } from "./dto/geo-location.dto";
import {
  CreateGeoRuleDto,
  GeoRuleAction,
  GeoRuleResponseDto,
  GeoRuleType,
  LocationCheckResponseDto,
  UpdateGeoRuleDto,
} from "./dto/geo-rule.dto";
import {
  CreateRegionPricingRuleDto,
  RegionPricingOverrideType,
  RegionPricingRuleResponseDto,
  RegionPricingRuleType,
  UpdateRegionPricingRuleDto,
} from "./dto/region-pricing-rule.dto";
import { GeoRulesService } from "./geo-rules.service";
import { GeolocationService } from "./geolocation.service";
import { RegionPricingService } from "./region-pricing.service";

@ApiTags("Geolocation")
@Controller()
export class GeolocationController {
  constructor(
    private readonly geolocationService: GeolocationService,
    private readonly geoRulesService: GeoRulesService,
    private readonly regionPricingService: RegionPricingService,
    private readonly contextService: ContextService,
  ) {}

  // Admin endpoints for geo rules

  @Get("admin/geolocation/rules")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List all geo rules" })
  @ApiResponse({
    status: 200,
    description: "Geo rules retrieved successfully",
    type: [GeoRuleResponseDto],
  })
  async listGeoRules(): Promise<GeoRuleResponseDto[]> {
    const rules = await this.geoRulesService.findAll();
    return rules.map(this.mapGeoRuleToDto);
  }

  @Post("admin/geolocation/rules")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a geo rule" })
  @ApiResponse({
    status: 201,
    description: "Geo rule created successfully",
    type: GeoRuleResponseDto,
  })
  async createGeoRule(
    @Body() dto: CreateGeoRuleDto,
  ): Promise<GeoRuleResponseDto> {
    const rule = await this.geoRulesService.create(dto);
    return this.mapGeoRuleToDto(rule);
  }

  @Put("admin/geolocation/rules/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a geo rule" })
  @ApiParam({ name: "id", description: "Geo rule ID" })
  @ApiResponse({
    status: 200,
    description: "Geo rule updated successfully",
    type: GeoRuleResponseDto,
  })
  async updateGeoRule(
    @Param("id") id: string,
    @Body() dto: UpdateGeoRuleDto,
  ): Promise<GeoRuleResponseDto> {
    const rule = await this.geoRulesService.update(id, dto);
    if (!rule) {
      throw new Error("Geo rule not found");
    }
    return this.mapGeoRuleToDto(rule);
  }

  @Delete("admin/geolocation/rules/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a geo rule" })
  @ApiParam({ name: "id", description: "Geo rule ID" })
  @ApiResponse({
    status: 204,
    description: "Geo rule deleted successfully",
  })
  async deleteGeoRule(@Param("id") id: string): Promise<void> {
    await this.geoRulesService.delete(id);
  }

  // Admin endpoints for region pricing rules

  @Get("admin/geolocation/region-pricing")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List all region pricing rules" })
  @ApiResponse({
    status: 200,
    description: "Region pricing rules retrieved successfully",
    type: [RegionPricingRuleResponseDto],
  })
  async listRegionPricingRules(): Promise<RegionPricingRuleResponseDto[]> {
    const rules = await this.regionPricingService.findAll();
    return rules.map(this.mapRegionPricingRuleToDto);
  }

  @Post("admin/geolocation/region-pricing")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a region pricing rule" })
  @ApiResponse({
    status: 201,
    description: "Region pricing rule created successfully",
    type: RegionPricingRuleResponseDto,
  })
  async createRegionPricingRule(
    @Body() dto: CreateRegionPricingRuleDto,
  ): Promise<RegionPricingRuleResponseDto> {
    const rule = await this.regionPricingService.create(dto);
    return this.mapRegionPricingRuleToDto(rule);
  }

  @Put("admin/geolocation/region-pricing/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a region pricing rule" })
  @ApiParam({ name: "id", description: "Region pricing rule ID" })
  @ApiResponse({
    status: 200,
    description: "Region pricing rule updated successfully",
    type: RegionPricingRuleResponseDto,
  })
  async updateRegionPricingRule(
    @Param("id") id: string,
    @Body() dto: UpdateRegionPricingRuleDto,
  ): Promise<RegionPricingRuleResponseDto> {
    const rule = await this.regionPricingService.update(id, dto);
    if (!rule) {
      throw new Error("Region pricing rule not found");
    }
    return this.mapRegionPricingRuleToDto(rule);
  }

  @Delete("admin/geolocation/region-pricing/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a region pricing rule" })
  @ApiParam({ name: "id", description: "Region pricing rule ID" })
  @ApiResponse({
    status: 204,
    description: "Region pricing rule deleted successfully",
  })
  async deleteRegionPricingRule(@Param("id") id: string): Promise<void> {
    await this.regionPricingService.delete(id);
  }

  // Public storefront endpoints

  @Get("store/check")
  @ApiOperation({ summary: "Check user location and restrictions" })
  @ApiResponse({
    status: 200,
    description: "Location check completed",
    type: LocationCheckResponseDto,
  })
  async checkLocation(): Promise<LocationCheckResponseDto> {
    const ip = this.contextService.getValue("ip");
    const location = ip ? await this.geolocationService.lookupIp(ip) : null;

    if (!location) {
      return {
        location: {
          ipAddress: ip || "unknown",
        },
        isRestricted: false,
        warningMessage: null,
        redirectUrl: null,
        action: null,
      };
    }

    const ruleCheck = await this.geoRulesService.checkLocation(location);

    return {
      location,
      isRestricted: ruleCheck.isRestricted,
      warningMessage: ruleCheck.warningMessage,
      redirectUrl: ruleCheck.redirectUrl,
      action: ruleCheck.action as GeoRuleAction | null,
    };
  }

  @Get("store/location")
  @ApiOperation({ summary: "Get current user location" })
  @ApiResponse({
    status: 200,
    description: "Location retrieved successfully",
    type: GeoLocationDto,
  })
  async getLocation(): Promise<GeoLocationDto | null> {
    const ip = this.contextService.getValue("ip");
    if (!ip || ip === "unknown") {
      return null;
    }

    return await this.geolocationService.lookupIp(ip);
  }

  // Helper methods

  private mapGeoRuleToDto(
    rule: typeof geoRules.$inferSelect,
  ): GeoRuleResponseDto {
    return {
      id: rule.id,
      name: rule.name,
      type: rule.type as GeoRuleType,
      countries: rule.countries,
      states: rule.states,
      action: rule.action as GeoRuleAction,
      redirectUrl: rule.redirectUrl,
      warningMessage: rule.warningMessage,
      isActive: rule.isActive,
      priority: rule.priority,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  private mapRegionPricingRuleToDto(
    rule: typeof regionPricingRules.$inferSelect,
  ): RegionPricingRuleResponseDto {
    return {
      id: rule.id,
      name: rule.name,
      type: rule.type as RegionPricingRuleType,
      countries: rule.countries,
      states: rule.states,
      productVariantId: rule.productVariantId,
      productId: rule.productId,
      categoryId: rule.categoryId,
      overrideType: rule.overrideType as RegionPricingOverrideType,
      overrideValue: rule.overrideValue,
      priority: rule.priority,
      isActive: rule.isActive,
      startDate: rule.startDate,
      endDate: rule.endDate,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
