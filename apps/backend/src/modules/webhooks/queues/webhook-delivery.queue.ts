import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

export const WEBHOOK_DELIVERY_QUEUE_NAME = "webhook-delivery";

export interface WebhookDeliveryJobData {
  webhookId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  url: string;
  secret: string;
  headers?: Record<string, string>;
  timeoutMs: number;
}

@Injectable()
export class WebhookDeliveryQueue {
  constructor(
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE_NAME)
    private readonly queue: Queue<WebhookDeliveryJobData>,
  ) {}

  /**
   * Add webhook delivery job to queue
   */
  async addJob(data: WebhookDeliveryJobData): Promise<void> {
    const retryConfig = {
      attempts: 5, // Max 5 attempts
      backoff: {
        type: "exponential" as const,
        delay: 1000, // Start with 1 second
      },
    };

    await this.queue.add("deliver-webhook", data, {
      ...retryConfig,
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        count: 5000, // Keep last 5000 failed jobs
      },
    });
  }
}
