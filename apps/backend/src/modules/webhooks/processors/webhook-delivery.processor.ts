import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import { webhookDeliveryLogs } from "@vcecom/db";
import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import type { Database } from "../../../modules/database/db";
import { DB_TOKEN } from "../../database/database.module";
import {
  WEBHOOK_DELIVERY_QUEUE_NAME,
  WebhookDeliveryJobData,
} from "../queues/webhook-delivery.queue";
import { WebhookSigningService } from "../services/webhook-signing.service";

@Processor(WEBHOOK_DELIVERY_QUEUE_NAME)
@Injectable()
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly signingService: WebhookSigningService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const {
      webhookId,
      eventType,
      eventId,
      payload,
      url,
      secret,
      headers,
      timeoutMs,
    } = job.data;
    const attemptNumber = (job.attemptsMade || 0) + 1;

    // Create log entry first
    const logId = crypto.randomUUID();
    await this.db
      .insert(webhookDeliveryLogs)
      .values({
        id: logId,
        webhookId,
        eventType,
        eventId,
        status: "pending",
        attemptCount: attemptNumber,
        requestBody: payload as Record<string, unknown>,
      })
      .catch((err) => {
        this.logger.warn(
          createErrorContext(this.contextService, "createLog", err, {
            logId,
            webhookId,
          }),
          "Failed to create webhook delivery log",
        );
      });
    const requestBody = {
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    };
    const requestBodyString = JSON.stringify(requestBody);

    try {
      // Sign the payload
      const signature = this.signingService.sign(requestBodyString, secret);

      // Prepare headers
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": eventType,
        "User-Agent": "VCEcom-Webhooks/1.0",
        ...headers,
      };

      // Make HTTP request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: requestHeaders,
          body: requestBodyString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseStatus = response.status;
        const responseText = await response.text();
        // Truncate response body if too long (max 10KB)
        const responseBody =
          responseText.length > 10000
            ? `${responseText.substring(0, 10000)}... (truncated)`
            : responseText;

        // Check if successful (2xx status codes)
        const isSuccess = responseStatus >= 200 && responseStatus < 300;

        if (isSuccess) {
          // Update log as success
          await this.db
            .update(webhookDeliveryLogs)
            .set({
              status: "success",
              responseStatus,
              responseBody,
              deliveredAt: new Date(),
              attemptCount: attemptNumber,
            })
            .where(eq(webhookDeliveryLogs.id, logId))
            .catch((err) => {
              this.logger.warn(
                createErrorContext(this.contextService, "updateLog", err, {
                  logId,
                  webhookId,
                }),
                "Failed to update webhook delivery log",
              );
            });

          this.logger.debug(
            createLogContext(this.contextService, "process", {
              webhookId,
              eventType,
              eventId,
              attemptNumber,
              status: responseStatus,
            }),
            `Webhook delivered successfully`,
          );
        } else {
          // Update log as failed
          await this.db
            .update(webhookDeliveryLogs)
            .set({
              status: "failed",
              responseStatus,
              responseBody,
              errorMessage: `HTTP ${responseStatus}: ${response.statusText}`,
              attemptCount: attemptNumber,
            })
            .where(eq(webhookDeliveryLogs.id, logId))
            .catch((err) => {
              this.logger.warn(
                createErrorContext(this.contextService, "updateLog", err, {
                  logId,
                  webhookId,
                }),
                "Failed to update webhook delivery log",
              );
            });

          // Throw error to trigger retry
          throw new Error(
            `Webhook delivery failed with status ${responseStatus}`,
          );
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);

        const errorMessage =
          fetchError instanceof Error
            ? fetchError.message
            : "Unknown error occurred";

        // Update log as failed
        await this.db
          .update(webhookDeliveryLogs)
          .set({
            status: "failed",
            errorMessage,
            attemptCount: attemptNumber,
          })
          .where(eq(webhookDeliveryLogs.id, logId))
          .catch((err) => {
            this.logger.warn(
              createErrorContext(this.contextService, "updateLog", err, {
                logId,
                webhookId,
              }),
              "Failed to update webhook delivery log",
            );
          });

        throw fetchError;
      }
    } catch (error) {
      this.logger.warn(
        createErrorContext(this.contextService, "process", error, {
          webhookId,
          eventType,
          eventId,
          attemptNumber,
        }),
        `Webhook delivery failed (attempt ${attemptNumber})`,
      );
      throw error; // Re-throw to trigger retry
    }
  }
}
