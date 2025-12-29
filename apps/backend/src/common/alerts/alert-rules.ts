/**
 * Prometheus alert rules for order module
 * These rules should be configured in your Prometheus server
 */

export const ORDER_ALERT_RULES = {
  /**
   * CRITICAL: Alert on any inventory commit failure
   * This indicates orders were created but inventory wasn't decremented
   */
  inventoryCommitFailure: {
    alert: "InventoryCommitFailure",
    expr: "increase(inventory_commit_failed_total[5m]) > 0",
    for: "0m", // Alert immediately
    labels: {
      severity: "critical",
      component: "orders",
    },
    annotations: {
      summary: "Inventory commit failure detected",
      description:
        "{{ $value }} inventory commit failure(s) detected in the last 5 minutes. " +
        "Orders may exist without inventory being decremented. Manual reconciliation required.",
    },
  },

  /**
   * Alert on high inventory commit failure rate
   */
  highInventoryCommitFailureRate: {
    alert: "HighInventoryCommitFailureRate",
    expr: "rate(inventory_commit_failed_total[5m]) / rate(orders_created_total[5m]) > 0.01",
    for: "5m",
    labels: {
      severity: "warning",
      component: "orders",
    },
    annotations: {
      summary: "High inventory commit failure rate",
      description:
        "Inventory commit failure rate is {{ $value | humanizePercentage }} of order creation rate.",
    },
  },

  /**
   * Alert on payment intent creation failures
   */
  paymentIntentCreationFailure: {
    alert: "PaymentIntentCreationFailure",
    expr: "increase(payment_intent_created_failed_total[5m]) > 10",
    for: "5m",
    labels: {
      severity: "warning",
      component: "orders",
    },
    annotations: {
      summary: "High payment intent creation failure rate",
      description:
        "{{ $value }} payment intent creation failures in the last 5 minutes.",
    },
  },

  /**
   * Alert on webhook processing failures
   */
  webhookProcessingFailure: {
    alert: "WebhookProcessingFailure",
    expr: "histogram_quantile(0.95, rate(webhook_processing_duration_seconds_bucket[5m])) > 10",
    for: "5m",
    labels: {
      severity: "warning",
      component: "orders",
    },
    annotations: {
      summary: "Slow webhook processing",
      description:
        "95th percentile webhook processing time is {{ $value }}s (threshold: 10s).",
    },
  },

  /**
   * Alert on order creation timeouts
   */
  orderCreationTimeout: {
    alert: "OrderCreationTimeout",
    expr: "histogram_quantile(0.95, rate(order_finalization_duration_seconds_bucket[5m])) > 30",
    for: "5m",
    labels: {
      severity: "warning",
      component: "orders",
    },
    annotations: {
      summary: "Slow order finalization",
      description:
        "95th percentile order finalization time is {{ $value }}s (threshold: 30s).",
    },
  },

  /**
   * Alert on high order creation failure rate
   */
  highOrderCreationFailureRate: {
    alert: "HighOrderCreationFailureRate",
    expr: "rate(orders_created_failed_total[5m]) / rate(orders_created_total[5m]) > 0.05",
    for: "5m",
    labels: {
      severity: "warning",
      component: "orders",
    },
    annotations: {
      summary: "High order creation failure rate",
      description:
        "Order creation failure rate is {{ $value | humanizePercentage }} of total attempts.",
    },
  },
};

/**
 * Prometheus alerting rules YAML format
 * Use this in your Prometheus configuration
 */
export const PROMETHEUS_ALERT_RULES_YAML = `
groups:
  - name: orders
    interval: 30s
    rules:
      - alert: InventoryCommitFailure
        expr: increase(inventory_commit_failed_total[5m]) > 0
        for: 0m
        labels:
          severity: critical
          component: orders
        annotations:
          summary: "Inventory commit failure detected"
          description: "{{ $value }} inventory commit failure(s) detected. Manual reconciliation required."

      - alert: HighInventoryCommitFailureRate
        expr: rate(inventory_commit_failed_total[5m]) / rate(orders_created_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
          component: orders
        annotations:
          summary: "High inventory commit failure rate"
          description: "Failure rate is {{ $value | humanizePercentage }}"

      - alert: PaymentIntentCreationFailure
        expr: increase(payment_intent_created_failed_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
          component: orders
        annotations:
          summary: "High payment intent creation failure rate"
          description: "{{ $value }} failures in the last 5 minutes"

      - alert: WebhookProcessingFailure
        expr: histogram_quantile(0.95, rate(webhook_processing_duration_seconds_bucket[5m])) > 10
        for: 5m
        labels:
          severity: warning
          component: orders
        annotations:
          summary: "Slow webhook processing"
          description: "95th percentile processing time is {{ $value }}s"

      - alert: OrderCreationTimeout
        expr: histogram_quantile(0.95, rate(order_finalization_duration_seconds_bucket[5m])) > 30
        for: 5m
        labels:
          severity: warning
          component: orders
        annotations:
          summary: "Slow order finalization"
          description: "95th percentile finalization time is {{ $value }}s"

      - alert: HighOrderCreationFailureRate
        expr: rate(orders_created_failed_total[5m]) / rate(orders_created_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
          component: orders
        annotations:
          summary: "High order creation failure rate"
          description: "Failure rate is {{ $value | humanizePercentage }}"
`;
