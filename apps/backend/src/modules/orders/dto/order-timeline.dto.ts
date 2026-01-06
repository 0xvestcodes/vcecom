import { ApiProperty } from "@nestjs/swagger";

export enum TimelineEventType {
  ORDER_CREATED = "order_created",
  ORDER_CONFIRMED = "order_confirmed",
  ORDER_PROCESSING = "order_processing",
  ORDER_SHIPPED = "order_shipped",
  ORDER_DELIVERED = "order_delivered",
  ORDER_CANCELLED = "order_cancelled",
  STATUS_CHANGED = "status_changed",
  PAYMENT_INTENT_CREATED = "payment_intent_created",
  PAYMENT_INITIATED = "payment_initiated",
  PAYMENT_COMPLETED = "payment_completed",
  PAYMENT_FAILED = "payment_failed",
  ORDER_MARKED_PAID = "order_marked_paid",
  CART_SNAPSHOT = "cart_snapshot",
  INVENTORY_RESERVED = "inventory_reserved",
  SHIPMENT_CREATED = "shipment_created",
  SHIPMENT_TRACKING_UPDATED = "shipment_tracking_updated",
  SHIPMENT_LABEL_GENERATED = "shipment_label_generated",
  SHIPMENT_PICKED_UP = "shipment_picked_up",
  SHIPMENT_IN_TRANSIT = "shipment_in_transit",
  SHIPMENT_OUT_FOR_DELIVERY = "shipment_out_for_delivery",
  SHIPMENT_DELIVERED = "shipment_delivered",
  SHIPMENT_FAILED = "shipment_failed",
  SHIPMENT_RETURNED = "shipment_returned",
  SHIPMENT_CANCELLED = "shipment_cancelled",
  NOTE_ADDED = "note_added",
  ADMIN_NOTE_ADDED = "admin_note_added",
  ADDRESS_UPDATED = "address_updated",
  REFUND_CREATED = "refund_created",
  REFUND_PROCESSED = "refund_processed",
  RETURN_REQUEST_CREATED = "return_request_created",
  RETURN_REQUEST_APPROVED = "return_request_approved",
  RETURN_REQUEST_REJECTED = "return_request_rejected",
  RETURN_IN_TRANSIT = "return_in_transit",
  RETURN_RECEIVED = "return_received",
  RETURN_COMPLETED = "return_completed",
  RATE_LIMIT_TRIGGERED = "rate_limit_triggered",
  CHECKOUT_MERGED = "checkout_merged",
  GUEST_CHECKOUT_DETECTED = "guest_checkout_detected",
  ABANDONED_CHECKOUT_RECOVERED = "abandoned_checkout_recovered",
}

export class TimelineEventDto {
  @ApiProperty({
    description: "Event type",
    enum: TimelineEventType,
    example: "status_changed",
  })
  type: TimelineEventType;

  @ApiProperty({
    description: "Event title",
    example: "Order Status Changed",
  })
  title: string;

  @ApiProperty({
    description: "Event description",
    example: "Order status changed from 'pending' to 'confirmed'",
  })
  description: string;

  @ApiProperty({
    description: "Previous value (if applicable)",
    example: "pending",
    nullable: true,
  })
  previousValue?: string | null;

  @ApiProperty({
    description: "New value (if applicable)",
    example: "confirmed",
    nullable: true,
  })
  newValue?: string | null;

  @ApiProperty({
    description: "Event timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "Additional metadata",
    example: { trackingNumber: "TRACK123456789" },
    nullable: true,
  })
  metadata?: Record<string, unknown> | null;

  @ApiProperty({
    description: "Actor who performed the action",
    example: "admin",
    enum: ["system", "admin", "customer", "automated"],
    nullable: true,
  })
  actor?: "system" | "admin" | "customer" | "automated";

  @ApiProperty({
    description: "Actor ID (user/admin ID)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  actorId?: string;

  @ApiProperty({
    description: "Actor name",
    example: "John Admin",
    nullable: true,
  })
  actorName?: string;

  @ApiProperty({
    description: "Actor email",
    example: "admin@example.com",
    nullable: true,
  })
  actorEmail?: string;

  @ApiProperty({
    description: "Trace ID for distributed tracing",
    example: "abc123def456",
    nullable: true,
  })
  traceId?: string;

  @ApiProperty({
    description: "Span ID for distributed tracing",
    example: "span789",
    nullable: true,
  })
  spanId?: string;

  @ApiProperty({
    description: "Request ID for request tracking",
    example: "req456",
    nullable: true,
  })
  requestId?: string;
}

export class OrderTimelineDto {
  @ApiProperty({
    description: "Order ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  orderId: string;

  @ApiProperty({
    description: "Order number",
    example: "ORD-2025-001234",
  })
  orderNumber: string;

  @ApiProperty({
    description: "Current order status",
    example: "shipped",
    enum: [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ],
  })
  currentStatus:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";

  @ApiProperty({
    description: "Timeline events (ordered by timestamp, newest first)",
    type: [TimelineEventDto],
  })
  events: TimelineEventDto[];
}
