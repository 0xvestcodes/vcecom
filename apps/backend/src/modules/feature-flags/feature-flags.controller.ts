import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { CreateFeatureFlagDto } from "./dto/create-feature-flag.dto";
import {
  FeatureFlagHistoryResponseDto,
  FeatureFlagListResponseDto,
  FeatureFlagResponseDto,
} from "./dto/feature-flag-response.dto";
import { SetFeatureFlagDto } from "./dto/set-feature-flag.dto";
import { FeatureFlagsService } from "./feature-flags.service";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    userId: string;
    email: string;
    role: string;
  };
}

@ApiTags("admin")
@Controller("admin/features")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "List all feature flags",
    description: "Get all feature flags with their current resolved states",
  })
  @ApiQuery({
    name: "adminId",
    required: false,
    type: String,
    description: "Admin ID for context resolution",
  })
  @ApiQuery({
    name: "storeId",
    required: false,
    type: String,
    description: "Store ID for context resolution",
  })
  @ApiQuery({
    name: "env",
    required: false,
    type: String,
    description: "Environment name for context resolution",
  })
  @ApiResponse({
    status: 200,
    description: "List of feature flags",
    type: FeatureFlagListResponseDto,
  })
  async getFeatureFlags(
    @Query("adminId") adminId?: string,
    @Query("storeId") storeId?: string,
    @Query("env") env?: string,
  ): Promise<FeatureFlagListResponseDto> {
    const flags = await this.featureFlagsService.getFeatureFlags({
      adminId,
      storeId,
      env,
    });

    return { flags };
  }

  @Get("resolve")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Resolve feature flags for current context",
    description:
      "Get all feature flags resolved for the current admin/store/environment context",
  })
  @ApiResponse({
    status: 200,
    description: "Resolved feature flags",
    type: FeatureFlagListResponseDto,
  })
  async resolveFeatureFlags(
    @Request() req: AuthenticatedRequest,
  ): Promise<FeatureFlagListResponseDto> {
    // TODO: Get storeId from request context if available
    const flags = await this.featureFlagsService.getFeatureFlags({
      adminId: req.user.id || req.user.userId,
    });

    return { flags };
  }

  @Post()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Create a new feature flag",
    description: "Register a new feature flag definition",
  })
  @ApiResponse({
    status: 201,
    description: "Feature flag created",
    type: FeatureFlagResponseDto,
  })
  async createFeatureFlag(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    return await this.featureFlagsService.createFeatureFlag(
      dto,
      req.user.id || req.user.userId,
    );
  }

  @Patch(":key")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Update feature flag default state",
    description:
      "Update the default state of a feature flag (not a scoped override)",
  })
  @ApiParam({
    name: "key",
    description: "Feature flag key",
  })
  @ApiResponse({
    status: 200,
    description: "Feature flag default state updated",
    type: FeatureFlagResponseDto,
  })
  async updateFeatureFlagDefaultState(
    @Param("key") key: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    return await this.featureFlagsService.updateDefaultState(
      key,
      dto.state,
      req.user.id || req.user.userId,
      dto.reason,
    );
  }

  @Post(":key/enable")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Enable a feature flag globally",
    description: "Set the default state of a feature flag to enabled",
  })
  @ApiParam({
    name: "key",
    description: "Feature flag key",
  })
  @ApiResponse({
    status: 200,
    description: "Feature flag enabled",
  })
  async enableFeatureFlag(
    @Param("key") key: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetFeatureFlagDto,
  ): Promise<{ message: string }> {
    await this.featureFlagsService.updateDefaultState(
      key,
      true,
      req.user.id || req.user.userId,
      dto.reason,
    );

    return { message: `Feature flag "${key}" enabled globally` };
  }

  @Post(":key/disable")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Disable a feature flag globally",
    description: "Set the default state of a feature flag to disabled",
  })
  @ApiParam({
    name: "key",
    description: "Feature flag key",
  })
  @ApiResponse({
    status: 200,
    description: "Feature flag disabled",
  })
  async disableFeatureFlag(
    @Param("key") key: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetFeatureFlagDto,
  ): Promise<{ message: string }> {
    await this.featureFlagsService.updateDefaultState(
      key,
      false,
      req.user.id || req.user.userId,
      dto.reason,
    );

    return { message: `Feature flag "${key}" disabled globally` };
  }

  @Post(":key/scope/admin/:adminId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Set admin-level override",
    description: "Set a feature flag override for a specific admin",
  })
  @ApiParam({
    name: "key",
    description: "Feature flag key",
  })
  @ApiParam({
    name: "adminId",
    description: "Admin user ID",
  })
  @ApiResponse({
    status: 200,
    description: "Override set",
  })
  async setAdminOverride(
    @Param("key") key: string,
    @Param("adminId") adminId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetFeatureFlagDto,
  ): Promise<{ message: string }> {
    await this.featureFlagsService.setFeatureFlag(
      key,
      "admin",
      adminId,
      dto.state,
      req.user.id || req.user.userId,
      dto.reason,
    );

    return {
      message: `Feature flag "${key}" override set for admin ${adminId}`,
    };
  }

  @Post(":key/scope/store/:storeId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Set store-level override",
    description: "Set a feature flag override for a specific store",
  })
  @ApiParam({
    name: "key",
    description: "Feature flag key",
  })
  @ApiParam({
    name: "storeId",
    description: "Store ID",
  })
  @ApiResponse({
    status: 200,
    description: "Override set",
  })
  async setStoreOverride(
    @Param("key") key: string,
    @Param("storeId") storeId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetFeatureFlagDto,
  ): Promise<{ message: string }> {
    await this.featureFlagsService.setFeatureFlag(
      key,
      "store",
      storeId,
      dto.state,
      req.user.id || req.user.userId,
      dto.reason,
    );

    return {
      message: `Feature flag "${key}" override set for store ${storeId}`,
    };
  }

  @Post(":key/scope/env/:envName")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({
    summary: "Set environment-level override",
    description: "Set a feature flag override for a specific environment",
  })
  @ApiParam({
    name: "key",
    description: "Feature flag key",
  })
  @ApiParam({
    name: "envName",
    description: "Environment name (development, staging, production)",
  })
  @ApiResponse({
    status: 200,
    description: "Override set",
  })
  async setEnvironmentOverride(
    @Param("key") key: string,
    @Param("envName") envName: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SetFeatureFlagDto,
  ): Promise<{ message: string }> {
    await this.featureFlagsService.setFeatureFlag(
      key,
      "environment",
      envName,
      dto.state,
      req.user.id || req.user.userId,
      dto.reason,
    );

    return {
      message: `Feature flag "${key}" override set for environment ${envName}`,
    };
  }

  @Delete(":key/scope/:scopeType/:scopeId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_DELETE)
  @ApiOperation({
    summary: "Remove feature flag override",
    description:
      "Remove a feature flag override, reverting to default or next precedence level",
  })
  @ApiParam({
    name: "key",
    description: "Feature flag key",
  })
  @ApiParam({
    name: "scopeType",
    enum: ["admin", "store", "environment"],
    description: "Scope type",
  })
  @ApiParam({
    name: "scopeId",
    description: "Scope ID",
  })
  @ApiQuery({
    name: "reason",
    required: false,
    type: String,
    description: "Reason for removal (for audit log)",
  })
  @ApiResponse({
    status: 200,
    description: "Override removed",
  })
  async removeOverride(
    @Param("key") key: string,
    @Param("scopeType") scopeType: "admin" | "store" | "environment",
    @Param("scopeId") scopeId: string,
    @Request() req: AuthenticatedRequest,
    @Query("reason") reason?: string,
  ): Promise<{ message: string }> {
    await this.featureFlagsService.removeFeatureFlag(
      key,
      scopeType,
      scopeId,
      req.user.id || req.user.userId,
      reason,
    );

    return { message: `Feature flag "${key}" override removed` };
  }

  @Get(":key/history")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get feature flag audit history",
    description: "Get audit log of changes for a feature flag",
  })
  @ApiParam({
    name: "key",
    description: "Feature flag key",
  })
  @ApiQuery({
    name: "scopeType",
    required: false,
    enum: ["admin", "store", "environment"],
    description: "Filter by scope type",
  })
  @ApiQuery({
    name: "scopeId",
    required: false,
    type: String,
    description: "Filter by scope ID",
  })
  @ApiResponse({
    status: 200,
    description: "Audit history",
    type: FeatureFlagHistoryResponseDto,
  })
  async getFeatureFlagHistory(
    @Param("key") key: string,
    @Query("scopeType") scopeType?: "admin" | "store" | "environment",
    @Query("scopeId") scopeId?: string,
  ): Promise<FeatureFlagHistoryResponseDto> {
    const history = await this.featureFlagsService.getFeatureFlagHistory(
      key,
      scopeType,
      scopeId,
    );

    return { history };
  }
}
