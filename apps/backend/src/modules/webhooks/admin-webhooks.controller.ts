import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { stores } from "@vcecom/db";
import { eq } from "drizzle-orm";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { IncomingWebhookResponseDto } from "./dto/incoming-webhook-response.dto";
import { QueryIncomingWebhooksDto } from "./dto/query-incoming-webhooks.dto";
import { QueryWebhookLogsDto } from "./dto/query-webhook-logs.dto";
import { QueryWebhooksDto } from "./dto/query-webhooks.dto";
import { TestWebhookDto } from "./dto/test-webhook.dto";
import { UpdateWebhookDto } from "./dto/update-webhook.dto";
import { WebhookLogResponseDto } from "./dto/webhook-log-response.dto";
import { WebhookResponseDto } from "./dto/webhook-response.dto";
import { AdminWebhooksService } from "./services/admin-webhooks.service";

@ApiTags("admin")
@Controller("admin/webhooks")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminWebhooksController {
  constructor(
    private readonly webhooksService: AdminWebhooksService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Get default store ID helper
   * Returns null if no store is found instead of throwing
   */
  private async getDefaultStoreId(): Promise<string | null> {
    const [defaultStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.isDefault, true))
      .limit(1);

    if (defaultStore) {
      return defaultStore.id;
    }

    const [firstStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .limit(1);
    if (firstStore) {
      return firstStore.id;
    }

    return null;
  }

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({ summary: "List webhooks" })
  @ApiResponse({
    status: 200,
    description: "List of webhooks",
    type: [WebhookResponseDto],
  })
  async listWebhooks(@Query() query: QueryWebhooksDto) {
    // If no storeId provided, try to use default store
    // If no store exists, allow query to proceed without storeId filter
    if (!query.storeId) {
      const defaultStoreId = await this.getDefaultStoreId();
      if (defaultStoreId) {
        query.storeId = defaultStoreId;
      }
    }
    return this.webhooksService.listWebhooks(query);
  }

  @Get("incoming")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({ summary: "List incoming webhooks" })
  @ApiResponse({
    status: 200,
    description: "List of incoming webhooks",
    type: [IncomingWebhookResponseDto],
  })
  async listIncomingWebhooks(@Query() query: QueryIncomingWebhooksDto) {
    // If no storeId provided, try to use default store
    // If no store exists, allow query to proceed without storeId filter
    if (!query.storeId) {
      const defaultStoreId = await this.getDefaultStoreId();
      if (defaultStoreId) {
        query.storeId = defaultStoreId;
      }
    }
    return this.webhooksService.listIncomingWebhooks(query);
  }

  @Get(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({ summary: "Get webhook by ID" })
  @ApiResponse({
    status: 200,
    description: "Webhook details",
    type: WebhookResponseDto,
  })
  async getWebhook(@Param("id") id: string) {
    return this.webhooksService.getWebhook(id);
  }

  @Post()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({ summary: "Create webhook" })
  @ApiResponse({
    status: 201,
    description: "Webhook created",
    type: WebhookResponseDto,
  })
  async createWebhook(@Body() dto: CreateWebhookDto) {
    const storeId = await this.getDefaultStoreId();
    if (!storeId) {
      throw new HttpException(
        "No store found. Please create a store before creating webhooks.",
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.webhooksService.createWebhook(dto, storeId);
  }

  @Patch(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_PATCH)
  @ApiOperation({ summary: "Update webhook" })
  @ApiResponse({
    status: 200,
    description: "Webhook updated",
    type: WebhookResponseDto,
  })
  async updateWebhook(@Param("id") id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.updateWebhook(id, dto);
  }

  @Delete(":id")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_DELETE)
  @ApiOperation({ summary: "Delete webhook" })
  @ApiResponse({ status: 204, description: "Webhook deleted" })
  async deleteWebhook(@Param("id") id: string) {
    await this.webhooksService.deleteWebhook(id);
    return { message: "Webhook deleted successfully" };
  }

  @Post(":id/test")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({ summary: "Test webhook delivery" })
  @ApiResponse({
    status: 200,
    description: "Test webhook queued",
  })
  async testWebhook(@Param("id") id: string, @Body() dto: TestWebhookDto) {
    return this.webhooksService.testWebhook(id, dto.payload, dto.eventType);
  }

  @Post(":id/enable")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({ summary: "Enable webhook" })
  @ApiResponse({
    status: 200,
    description: "Webhook enabled",
    type: WebhookResponseDto,
  })
  async enableWebhook(@Param("id") id: string) {
    return this.webhooksService.enableWebhook(id);
  }

  @Post(":id/disable")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_POST)
  @ApiOperation({ summary: "Disable webhook" })
  @ApiResponse({
    status: 200,
    description: "Webhook disabled",
    type: WebhookResponseDto,
  })
  async disableWebhook(@Param("id") id: string) {
    return this.webhooksService.disableWebhook(id);
  }

  @Get(":id/logs")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({ summary: "Get webhook delivery logs" })
  @ApiResponse({
    status: 200,
    description: "Webhook delivery logs",
    type: [WebhookLogResponseDto],
  })
  async getWebhookLogs(
    @Param("id") id: string,
    @Query() query: QueryWebhookLogsDto,
  ) {
    return this.webhooksService.getWebhookLogs(id, query);
  }
}
