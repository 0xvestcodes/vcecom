import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request as ExpressRequest } from "express";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ApiKeysService, CreateApiKeyDto } from "./api-keys.service";

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
  };
}

@ApiTags("admin")
@Controller("admin/api-keys")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Roles("admin")
  @ApiOperation({ summary: "Create a new API key" })
  @ApiResponse({ status: 201, description: "API key created successfully" })
  async createApiKey(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.createApiKey(req.user.id, dto);
  }

  @Get()
  @Roles("admin")
  @ApiOperation({ summary: "List all API keys for the current user" })
  @ApiResponse({ status: 200, description: "List of API keys" })
  async listApiKeys(@Request() req: AuthenticatedRequest) {
    return this.apiKeysService.listApiKeys(req.user.id);
  }

  @Get(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Get API key by ID" })
  @ApiResponse({ status: 200, description: "API key details" })
  async getApiKey(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.apiKeysService.getApiKey(req.user.id, id);
  }

  @Delete(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Revoke an API key" })
  @ApiResponse({ status: 200, description: "API key revoked successfully" })
  async revokeApiKey(
    @Request() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    await this.apiKeysService.revokeApiKey(req.user.id, id, req.user.id);
    return { message: "API key revoked successfully" };
  }
}
