/**
 * Order lifecycle event types
 */
export enum OrderEventType {
  ORDER_CREATED = "order.created",
  ORDER_CONFIRMED = "order.confirmed",
  ORDER_PROCESSING = "order.processing",
  ORDER_SHIPPED = "order.shipped",
  ORDER_DELIVERED = "order.delivered",
  ORDER_CANCELLED = "order.cancelled",
  ORDER_PAYMENT_COMPLETED = "order.payment.completed",
  ORDER_PAYMENT_FAILED = "order.payment.failed",
  ORDER_REFUND_INITIATED = "order.refund.initiated",
  ORDER_REFUND_COMPLETED = "order.refund.completed",
}

/**
 * Base order event payload
 */
export interface BaseOrderEventPayload {
  orderId: string;
  orderNumber: string;
  customerId?: string | null;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Order created event payload
 */
export interface OrderCreatedEventPayload extends BaseOrderEventPayload {
  total: number;
  itemsCount: number;
}

/**
 * Order confirmed event payload
 */
export interface OrderConfirmedEventPayload extends BaseOrderEventPayload {
  confirmedBy?: string; // Admin ID or system
}

/**
 * Order processing event payload
 */
export interface OrderProcessingEventPayload extends BaseOrderEventPayload {
  processingStartedBy?: string; // Admin ID or system
}

/**
 * Order shipped event payload
 */
export interface OrderShippedEventPayload extends BaseOrderEventPayload {
  trackingNumber: string;
  awbNumber?: string;
  courierName?: string;
}

/**
 * Order delivered event payload
 */
export interface OrderDeliveredEventPayload extends BaseOrderEventPayload {
  deliveredAt: Date;
}

/**
 * Order cancelled event payload
 */
export interface OrderCancelledEventPayload extends BaseOrderEventPayload {
  reason?: string;
  cancelledBy?: string; // Admin ID or customer ID
}

/**
 * Order payment completed event payload
 */
export interface OrderPaymentCompletedEventPayload
  extends BaseOrderEventPayload {
  paymentIntentId: string;
  amount: number;
  paymentMethod: string;
}

/**
 * Order payment failed event payload
 */
export interface OrderPaymentFailedEventPayload extends BaseOrderEventPayload {
  paymentIntentId: string;
  failureReason?: string;
}

/**
 * Order refund initiated event payload
 */
export interface OrderRefundInitiatedEventPayload
  extends BaseOrderEventPayload {
  refundId: string;
  amount: number;
  reason?: string;
}

/**
 * Order refund completed event payload
 */
export interface OrderRefundCompletedEventPayload
  extends BaseOrderEventPayload {
  refundId: string;
  amount: number;
  refundMethod: string;
}

/**
 * Union type for all order event payloads
 */
export type OrderEventPayload =
  | OrderCreatedEventPayload
  | OrderConfirmedEventPayload
  | OrderProcessingEventPayload
  | OrderShippedEventPayload
  | OrderDeliveredEventPayload
  | OrderCancelledEventPayload
  | OrderPaymentCompletedEventPayload
  | OrderPaymentFailedEventPayload
  | OrderRefundInitiatedEventPayload
  | OrderRefundCompletedEventPayload;
