import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  Counter,
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
  private register: Registry;

  // Order metrics
  public readonly orderCreatedTotal: Counter<string>;
  public readonly orderCreatedFailedTotal: Counter<string>;
  public readonly paymentIntentCreatedTotal: Counter<string>;
  public readonly paymentIntentCreatedFailedTotal: Counter<string>;
  public readonly inventoryCommitFailedTotal: Counter<string>;
  public readonly webhookProcessingDuration: Histogram<string>;
  public readonly orderFinalizationDuration: Histogram<string>;
  public readonly codOrderRatio: Gauge<string>;
  public readonly paymentGatewayOrderRatio: Gauge<string>;

  constructor() {
    this.register = new Registry();
    collectDefaultMetrics({ register: this.register });

    // Order creation metrics
    this.orderCreatedTotal = new Counter({
      name: "orders_created_total",
      help: "Total number of orders created successfully",
      labelNames: ["payment_method", "status"],
      registers: [this.register],
    });

    this.orderCreatedFailedTotal = new Counter({
      name: "orders_created_failed_total",
      help: "Total number of failed order creation attempts",
      labelNames: ["error_type", "payment_method"],
      registers: [this.register],
    });

    // Payment intent metrics
    this.paymentIntentCreatedTotal = new Counter({
      name: "payment_intent_created_total",
      help: "Total number of payment intents created successfully",
      labelNames: ["provider"],
      registers: [this.register],
    });

    this.paymentIntentCreatedFailedTotal = new Counter({
      name: "payment_intent_created_failed_total",
      help: "Total number of failed payment intent creation attempts",
      labelNames: ["provider", "error_type"],
      registers: [this.register],
    });

    // Inventory commit failure metric (CRITICAL)
    this.inventoryCommitFailedTotal = new Counter({
      name: "inventory_commit_failed_total",
      help: "Total number of inventory commit failures (CRITICAL - requires manual reconciliation)",
      labelNames: ["order_id", "cart_id"],
      registers: [this.register],
    });

    // Webhook processing time
    this.webhookProcessingDuration = new Histogram({
      name: "webhook_processing_duration_seconds",
      help: "Duration of webhook processing in seconds",
      labelNames: ["provider", "event_type"],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // Order finalization time
    this.orderFinalizationDuration = new Histogram({
      name: "order_finalization_duration_seconds",
      help: "Duration of order finalization in seconds",
      labelNames: ["payment_method"],
      buckets: [0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register],
    });

    // Order type ratios
    this.codOrderRatio = new Gauge({
      name: "cod_order_ratio",
      help: "Ratio of COD orders to total orders",
      registers: [this.register],
    });

    this.paymentGatewayOrderRatio = new Gauge({
      name: "payment_gateway_order_ratio",
      help: "Ratio of payment gateway orders to total orders",
      registers: [this.register],
    });

    this.register.registerMetric(this.orderCreatedTotal);
    this.register.registerMetric(this.orderCreatedFailedTotal);
    this.register.registerMetric(this.paymentIntentCreatedTotal);
    this.register.registerMetric(this.paymentIntentCreatedFailedTotal);
    this.register.registerMetric(this.inventoryCommitFailedTotal);
    this.register.registerMetric(this.webhookProcessingDuration);
    this.register.registerMetric(this.orderFinalizationDuration);
    this.register.registerMetric(this.codOrderRatio);
    this.register.registerMetric(this.paymentGatewayOrderRatio);
  }

  onModuleInit() {
    // Metrics are initialized in constructor
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getRegister(): Registry {
    return this.register;
  }
}
