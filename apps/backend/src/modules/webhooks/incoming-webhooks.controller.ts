import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { incomingWebhooks, stores } from "@vcecom/db";
import { eq } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { WebhookSigningService } from "./services/webhook-signing.service";

type IncomingWebhookProvider =
  | "razorpay"
  | "shiprocket"
  | "nimbus_post"
  | "generic";

@ApiTags("webhooks")
@Controller("webhooks/incoming")
export class IncomingWebhooksController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    readonly _signingService: WebhookSigningService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Handle incoming webhook from Razorpay
   */
  @Post("razorpay")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive Razorpay webhook" })
  @ApiResponse({ status: 200, description: "Webhook received successfully" })
  async handleRazorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Query("storeId") storeId?: string,
  ): Promise<{ received: boolean }> {
    return this.handleIncomingWebhook(
      "razorpay",
      payload,
      headers,
      req.rawBody?.toString() || JSON.stringify(payload),
      storeId,
    );
  }

  /**
   * Handle incoming webhook from Shiprocket
   */
  @Post("shiprocket")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive Shiprocket webhook" })
  @ApiResponse({ status: 200, description: "Webhook received successfully" })
  async handleShiprocketWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Query("storeId") storeId?: string,
  ): Promise<{ received: boolean }> {
    return this.handleIncomingWebhook(
      "shiprocket",
      payload,
      headers,
      req.rawBody?.toString() || JSON.stringify(payload),
      storeId,
    );
  }

  /**
   * Handle incoming webhook from Nimbus Post
   */
  @Post("nimbus_post")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive Nimbus Post webhook" })
  @ApiResponse({ status: 200, description: "Webhook received successfully" })
  async handleNimbusPostWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Query("storeId") storeId?: string,
  ): Promise<{ received: boolean }> {
    return this.handleIncomingWebhook(
      "nimbus_post",
      payload,
      headers,
      req.rawBody?.toString() || JSON.stringify(payload),
      storeId,
    );
  }

  /**
   * Handle generic incoming webhook
   */
  @Post("generic")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive generic webhook" })
  @ApiResponse({ status: 200, description: "Webhook received successfully" })
  async handleGenericWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Query("storeId") storeId?: string,
    @Query("eventType") eventType?: string,
  ): Promise<{ received: boolean }> {
    return this.handleIncomingWebhook(
      "generic",
      payload,
      headers,
      req.rawBody?.toString() || JSON.stringify(payload),
      storeId,
      eventType,
    );
  }

  /**
   * Handle incoming webhook
   */
  private async handleIncomingWebhook(
    provider: IncomingWebhookProvider,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
    rawBody: string,
    storeId?: string,
    eventType?: string,
  ): Promise<{ received: boolean }> {
    try {
      // Get store ID (use default if not provided)
      let finalStoreId = storeId;
      if (!finalStoreId) {
        const [defaultStore] = await this.db
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.isDefault, true))
          .limit(1);
        finalStoreId = defaultStore?.id || undefined;

        if (!finalStoreId) {
          const [firstStore] = await this.db
            .select({ id: stores.id })
            .from(stores)
            .limit(1);
          finalStoreId = firstStore?.id || undefined;
        }
      }

      if (!finalStoreId) {
        this.logger.warn(
          createLogContext(this.contextService, "handleIncomingWebhook", {
            provider,
          }),
          "No store found for incoming webhook",
        );
        return { received: false };
      }

      // Extract signature from headers
      const signatureHeader =
        headers["x-webhook-signature"] ||
        headers["x-razorpay-signature"] ||
        headers["x-shiprocket-signature"] ||
        headers.signature ||
        "";

      // Determine event type from payload or query param
      const finalEventType =
        eventType ||
        (payload.event as string) ||
        (payload.event_type as string) ||
        (payload.type as string) ||
        "unknown";

      // Validate signature if provider-specific validation is needed
      // For now, we'll store the webhook and let the processing logic handle validation
      const isValid = await this.validateWebhookSignature(
        provider,
        rawBody,
        signatureHeader,
      );

      // Store incoming webhook
      await this.db.insert(incomingWebhooks).values({
        storeId: finalStoreId,
        provider,
        eventType: finalEventType,
        payload,
        signature: signatureHeader || null,
        headers: headers as Record<string, string>,
        status: isValid ? "pending" : "failed",
        errorMessage: isValid ? null : "Invalid signature",
      });

      this.logger.debug(
        createLogContext(this.contextService, "handleIncomingWebhook", {
          provider,
          eventType: finalEventType,
          storeId: finalStoreId,
        }),
        `Received incoming webhook from ${provider}`,
      );

      return { received: true };
    } catch (error) {
      this.logger.warn(
        createErrorContext(
          this.contextService,
          "handleIncomingWebhook",
          error,
          {
            provider,
          },
        ),
        `Failed to handle incoming webhook`,
      );
      return { received: false };
    }
  }

  /**
   * Validate webhook signature based on provider
   */
  private async validateWebhookSignature(
    provider: IncomingWebhookProvider,
    rawBody: string,
    signature: string,
  ): Promise<boolean> {
    // For generic webhooks, signature validation is optional
    if (provider === "generic") {
      return true; // Or implement custom validation logic
    }

    // For Razorpay, Shiprocket, Nimbus Post - implement provider-specific validation
    // This is a placeholder - actual validation should use provider-specific secrets
    // TODO: Implement provider-specific signature validation
    if (!signature) {
      return false;
    }

    // For now, return true if signature exists
    // In production, validate against provider-specific secrets
    return true;
  }
}
