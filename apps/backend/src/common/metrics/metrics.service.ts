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

  // Search metrics
  public readonly searchQueryDuration: Histogram<string>;
  public readonly searchQueryTotal: Counter<string>;
  public readonly searchQueryFailedTotal: Counter<string>;
  public readonly indexingDuration: Histogram<string>;
  public readonly indexingSuccessTotal: Counter<string>;
  public readonly indexingFailedTotal: Counter<string>;
  public readonly reindexDuration: Histogram<string>;
  public readonly searchIndexSize: Gauge<string>;
  public readonly searchIndexFreshness: Gauge<string>;

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

    // Search query metrics
    this.searchQueryDuration = new Histogram({
      name: "search_query_duration_seconds",
      help: "Duration of search queries in seconds",
      labelNames: ["index", "provider"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    this.searchQueryTotal = new Counter({
      name: "search_queries_total",
      help: "Total number of search queries",
      labelNames: ["index", "provider"],
      registers: [this.register],
    });

    this.searchQueryFailedTotal = new Counter({
      name: "search_queries_failed_total",
      help: "Total number of failed search queries",
      labelNames: ["index", "provider", "error_type"],
      registers: [this.register],
    });

    // Indexing metrics
    this.indexingDuration = new Histogram({
      name: "search_indexing_duration_seconds",
      help: "Duration of indexing operations in seconds",
      labelNames: ["index", "operation"],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register],
    });

    this.indexingSuccessTotal = new Counter({
      name: "search_indexing_success_total",
      help: "Total number of successful indexing operations",
      labelNames: ["index", "operation"],
      registers: [this.register],
    });

    this.indexingFailedTotal = new Counter({
      name: "search_indexing_failed_total",
      help: "Total number of failed indexing operations",
      labelNames: ["index", "operation", "error_type"],
      registers: [this.register],
    });

    // Reindex metrics
    this.reindexDuration = new Histogram({
      name: "search_reindex_duration_seconds",
      help: "Duration of reindex operations in seconds",
      labelNames: ["entity_type"],
      buckets: [10, 30, 60, 300, 600, 1800, 3600],
      registers: [this.register],
    });

    // Index size and freshness
    this.searchIndexSize = new Gauge({
      name: "search_index_size_bytes",
      help: "Size of search indexes in bytes",
      labelNames: ["index"],
      registers: [this.register],
    });

    this.searchIndexFreshness = new Gauge({
      name: "search_index_freshness_seconds",
      help: "Time since last index update in seconds",
      labelNames: ["index"],
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
    this.register.registerMetric(this.searchQueryDuration);
    this.register.registerMetric(this.searchQueryTotal);
    this.register.registerMetric(this.searchQueryFailedTotal);
    this.register.registerMetric(this.indexingDuration);
    this.register.registerMetric(this.indexingSuccessTotal);
    this.register.registerMetric(this.indexingFailedTotal);
    this.register.registerMetric(this.reindexDuration);
    this.register.registerMetric(this.searchIndexSize);
    this.register.registerMetric(this.searchIndexFreshness);
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
