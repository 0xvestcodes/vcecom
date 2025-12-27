import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  desc,
  eq,
  orderNotes,
  orders,
  payments,
  refunds,
  shipments,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  OrderTimelineDto,
  TimelineEventDto,
  TimelineEventType,
} from "../dto/order-timeline.dto";
import { OrderTrackingDto } from "../dto/order-tracking.dto";
import { OrderValidationService } from "./order-validation.service";

/**
 * Service responsible for order timeline and tracking
 * Handles order event history and shipment tracking
 */
@Injectable()
export class OrderTimelineService {
  constructor(
    readonly _logger: PinoLogger,
    private readonly validationService: OrderValidationService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Get order tracking information
   * Returns order details with shipment tracking information
   * @param userId - User ID
   * @param orderId - Order ID
   * @returns Order tracking information with shipments
   * @throws NotFoundException if order not found
   */
  async getTracking(
    userId: string,
    orderId: string,
  ): Promise<OrderTrackingDto> {
    const customerId = await this.validationService.getCustomerId(userId);

    // Get order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Get shipments for this order
    const orderShipments = await this.db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .orderBy(desc(shipments.createdAt));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      shippingProvider: order.shippingProvider,
      shipments: orderShipments.map((shipment) => ({
        id: shipment.id,
        provider: shipment.provider,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        labelUrl: shipment.labelUrl,
        awbNumber: shipment.awbNumber,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Get order timeline
   * Returns chronological list of all events related to the order
   * @param userId - User ID
   * @param orderId - Order ID
   * @returns Order timeline with all events
   * @throws NotFoundException if order not found
   */
  async getTimeline(
    userId: string,
    orderId: string,
  ): Promise<OrderTimelineDto> {
    const customerId = await this.validationService.getCustomerId(userId);

    // Get order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const events: TimelineEventDto[] = [];

    // Add order creation event
    events.push({
      type: TimelineEventType.ORDER_CREATED,
      title: "Order Created",
      description: `Order ${order.orderNumber} was created`,
      timestamp: order.createdAt,
      metadata: {
        orderNumber: order.orderNumber,
        total: order.total,
      },
    });

    // Get payments for this order
    const orderPayments = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));

    // Add payment events
    for (const payment of orderPayments) {
      events.push({
        type: TimelineEventType.PAYMENT_INITIATED,
        title: "Payment Initiated",
        description: `Payment of ₹${payment.amount} initiated via ${payment.method}`,
        timestamp: payment.createdAt,
        metadata: {
          paymentId: payment.id,
          amount: payment.amount,
          method: payment.method,
          razorpayPaymentId: payment.razorpayPaymentId,
        },
      });

      if (payment.status === "captured") {
        events.push({
          type: TimelineEventType.PAYMENT_COMPLETED,
          title: "Payment Completed",
          description: `Payment of ₹${payment.amount} was successfully completed`,
          timestamp: payment.updatedAt,
          metadata: {
            paymentId: payment.id,
            amount: payment.amount,
            method: payment.method,
          },
        });
      } else if (payment.status === "failed") {
        events.push({
          type: TimelineEventType.PAYMENT_FAILED,
          title: "Payment Failed",
          description: `Payment of ₹${payment.amount} failed`,
          timestamp: payment.updatedAt,
          metadata: {
            paymentId: payment.id,
            amount: payment.amount,
            method: payment.method,
          },
        });
      }
    }

    // Get shipments for this order
    const orderShipments = await this.db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .orderBy(desc(shipments.createdAt));

    // Add shipment events
    for (const shipment of orderShipments) {
      events.push({
        type: TimelineEventType.SHIPMENT_CREATED,
        title: "Shipment Created",
        description: `Shipment created via ${shipment.provider}`,
        timestamp: shipment.createdAt,
        metadata: {
          shipmentId: shipment.id,
          provider: shipment.provider,
        },
      });

      if (shipment.trackingNumber) {
        events.push({
          type: TimelineEventType.SHIPMENT_TRACKING_UPDATED,
          title: "Tracking Number Assigned",
          description: `Tracking number: ${shipment.trackingNumber}`,
          timestamp: shipment.updatedAt,
          metadata: {
            shipmentId: shipment.id,
            trackingNumber: shipment.trackingNumber,
            awbNumber: shipment.awbNumber,
          },
        });
      }

      if (shipment.status === "delivered") {
        events.push({
          type: TimelineEventType.SHIPMENT_DELIVERED,
          title: "Shipment Delivered",
          description: "Your order has been delivered",
          timestamp: shipment.updatedAt,
          metadata: {
            shipmentId: shipment.id,
            trackingNumber: shipment.trackingNumber,
          },
        });
      }
    }

    // Add status change events based on order status
    if (order.status === "confirmed") {
      events.push({
        type: TimelineEventType.ORDER_CONFIRMED,
        title: "Order Confirmed",
        description: "Your order has been confirmed",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    } else if (order.status === "processing") {
      events.push({
        type: TimelineEventType.ORDER_PROCESSING,
        title: "Order Processing",
        description: "Your order is being processed",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    } else if (order.status === "shipped") {
      events.push({
        type: TimelineEventType.ORDER_SHIPPED,
        title: "Order Shipped",
        description: "Your order has been shipped",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    } else if (order.status === "delivered") {
      events.push({
        type: TimelineEventType.ORDER_DELIVERED,
        title: "Order Delivered",
        description: "Your order has been delivered",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    } else if (order.status === "cancelled") {
      events.push({
        type: TimelineEventType.ORDER_CANCELLED,
        title: "Order Cancelled",
        description: "Your order has been cancelled",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    }

    // Get order notes
    const orderNotesList = await this.db
      .select()
      .from(orderNotes)
      .where(eq(orderNotes.orderId, orderId))
      .orderBy(desc(orderNotes.createdAt));

    // Add note events
    for (const note of orderNotesList) {
      events.push({
        type: note.isPublic
          ? TimelineEventType.NOTE_ADDED
          : TimelineEventType.ADMIN_NOTE_ADDED,
        title: note.isPublic ? "Note Added" : "Admin Note Added",
        description: note.note,
        timestamp: note.createdAt,
        actor: note.authorId ? "admin" : "system",
        actorId: note.authorId || undefined,
        actorName: note.authorName || undefined,
        actorEmail: note.authorEmail || undefined,
        metadata: {
          noteId: note.id,
          isPublic: note.isPublic,
        },
      });
    }

    // Get refunds for this order
    const orderRefunds = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, orderId))
      .orderBy(desc(refunds.createdAt));

    // Add refund events
    for (const refund of orderRefunds) {
      events.push({
        type: TimelineEventType.REFUND_CREATED,
        title: "Refund Created",
        description: `Refund of ₹${refund.amount} created. Reason: ${refund.reason}`,
        timestamp: refund.createdAt,
        actor: "admin",
        metadata: {
          refundId: refund.id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
        },
      });

      if (refund.status === "completed" && refund.processedAt) {
        events.push({
          type: TimelineEventType.REFUND_PROCESSED,
          title: "Refund Processed",
          description: `Refund of ₹${refund.amount} has been processed`,
          timestamp: refund.processedAt,
          actor: "system",
          metadata: {
            refundId: refund.id,
            providerRefundId: refund.providerRefundId,
          },
        });
      } else if (refund.status === "failed") {
        events.push({
          type: TimelineEventType.REFUND_PROCESSED,
          title: "Refund Failed",
          description: `Refund of ₹${refund.amount} failed to process`,
          timestamp: refund.updatedAt,
          actor: "system",
          metadata: {
            refundId: refund.id,
            status: refund.status,
          },
        });
      }
    }

    // Add shipment cancelled events
    for (const shipment of orderShipments) {
      if (shipment.status === "cancelled") {
        events.push({
          type: TimelineEventType.SHIPMENT_CANCELLED,
          title: "Shipment Cancelled",
          description: `Shipment ${shipment.awbNumber || shipment.trackingNumber || shipment.id} was cancelled`,
          timestamp: shipment.updatedAt,
          actor: "admin",
          metadata: {
            shipmentId: shipment.id,
            awbNumber: shipment.awbNumber,
            trackingNumber: shipment.trackingNumber,
          },
        });
      }
    }

    // Sort events by timestamp (oldest first)
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      currentStatus: order.status as
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded",
      events,
    };
  }

  /**
   * Get order tracking information (admin - no user validation)
   */
  async getTrackingForAdmin(orderId: string): Promise<OrderTrackingDto> {
    // Get order (no customer validation for admin)
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Get shipments for this order
    const orderShipments = await this.db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .orderBy(desc(shipments.createdAt));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      shippingProvider: order.shippingProvider,
      shipments: orderShipments.map((shipment) => ({
        id: shipment.id,
        provider: shipment.provider,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        labelUrl: shipment.labelUrl,
        awbNumber: shipment.awbNumber,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Get order timeline (admin - no user validation)
   */
  async getTimelineForAdmin(orderId: string): Promise<OrderTimelineDto> {
    // Get order (no customer validation for admin)
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Reuse the same timeline logic but without user validation
    // We'll call getTimeline with a dummy userId, but first we need to get customerId
    const _customerId = order.customerId;

    // We need to get userId from customerId - but for admin, we can skip this
    // Instead, let's duplicate the timeline logic without user validation
    const events: TimelineEventDto[] = [];

    // Add order creation event
    events.push({
      type: TimelineEventType.ORDER_CREATED,
      title: "Order Created",
      description: `Order ${order.orderNumber} was created`,
      timestamp: order.createdAt,
      metadata: {
        orderNumber: order.orderNumber,
        total: order.total,
      },
    });

    // Get payments for this order
    const orderPayments = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));

    // Add payment events
    for (const payment of orderPayments) {
      events.push({
        type: TimelineEventType.PAYMENT_INITIATED,
        title: "Payment Initiated",
        description: `Payment of ₹${payment.amount} initiated via ${payment.method}`,
        timestamp: payment.createdAt,
        metadata: {
          paymentId: payment.id,
          amount: payment.amount,
          method: payment.method,
          razorpayPaymentId: payment.razorpayPaymentId,
        },
      });

      if (payment.status === "captured") {
        events.push({
          type: TimelineEventType.PAYMENT_COMPLETED,
          title: "Payment Completed",
          description: `Payment of ₹${payment.amount} was successfully completed`,
          timestamp: payment.updatedAt,
          metadata: {
            paymentId: payment.id,
            amount: payment.amount,
            method: payment.method,
          },
        });
      } else if (payment.status === "failed") {
        events.push({
          type: TimelineEventType.PAYMENT_FAILED,
          title: "Payment Failed",
          description: `Payment of ₹${payment.amount} failed`,
          timestamp: payment.updatedAt,
          metadata: {
            paymentId: payment.id,
            amount: payment.amount,
            method: payment.method,
          },
        });
      }
    }

    // Get shipments for this order
    const orderShipments = await this.db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .orderBy(desc(shipments.createdAt));

    // Add shipment events
    for (const shipment of orderShipments) {
      events.push({
        type: TimelineEventType.SHIPMENT_CREATED,
        title: "Shipment Created",
        description: `Shipment created via ${shipment.provider}`,
        timestamp: shipment.createdAt,
        metadata: {
          shipmentId: shipment.id,
          provider: shipment.provider,
        },
      });

      if (shipment.trackingNumber) {
        events.push({
          type: TimelineEventType.SHIPMENT_TRACKING_UPDATED,
          title: "Tracking Number Assigned",
          description: `Tracking number: ${shipment.trackingNumber}`,
          timestamp: shipment.updatedAt,
          metadata: {
            shipmentId: shipment.id,
            trackingNumber: shipment.trackingNumber,
            awbNumber: shipment.awbNumber,
          },
        });
      }

      if (shipment.status === "delivered") {
        events.push({
          type: TimelineEventType.SHIPMENT_DELIVERED,
          title: "Shipment Delivered",
          description: "Your order has been delivered",
          timestamp: shipment.updatedAt,
          metadata: {
            shipmentId: shipment.id,
            trackingNumber: shipment.trackingNumber,
          },
        });
      }
    }

    // Add status change events based on order status
    if (order.status === "confirmed") {
      events.push({
        type: TimelineEventType.ORDER_CONFIRMED,
        title: "Order Confirmed",
        description: "Your order has been confirmed",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    } else if (order.status === "processing") {
      events.push({
        type: TimelineEventType.ORDER_PROCESSING,
        title: "Order Processing",
        description: "Your order is being processed",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    } else if (order.status === "shipped") {
      events.push({
        type: TimelineEventType.ORDER_SHIPPED,
        title: "Order Shipped",
        description: "Your order has been shipped",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    } else if (order.status === "delivered") {
      events.push({
        type: TimelineEventType.ORDER_DELIVERED,
        title: "Order Delivered",
        description: "Your order has been delivered",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    } else if (order.status === "cancelled") {
      events.push({
        type: TimelineEventType.ORDER_CANCELLED,
        title: "Order Cancelled",
        description: "Your order has been cancelled",
        timestamp: order.updatedAt,
        metadata: {
          orderNumber: order.orderNumber,
        },
      });
    }

    // Get order notes
    const orderNotesList = await this.db
      .select()
      .from(orderNotes)
      .where(eq(orderNotes.orderId, orderId))
      .orderBy(desc(orderNotes.createdAt));

    // Add note events
    for (const note of orderNotesList) {
      events.push({
        type: note.isPublic
          ? TimelineEventType.NOTE_ADDED
          : TimelineEventType.ADMIN_NOTE_ADDED,
        title: note.isPublic ? "Note Added" : "Admin Note Added",
        description: note.note,
        timestamp: note.createdAt,
        actor: note.authorId ? "admin" : "system",
        actorId: note.authorId || undefined,
        actorName: note.authorName || undefined,
        actorEmail: note.authorEmail || undefined,
        metadata: {
          noteId: note.id,
          isPublic: note.isPublic,
        },
      });
    }

    // Get refunds for this order
    const orderRefunds = await this.db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, orderId))
      .orderBy(desc(refunds.createdAt));

    // Add refund events
    for (const refund of orderRefunds) {
      events.push({
        type: TimelineEventType.REFUND_CREATED,
        title: "Refund Created",
        description: `Refund of ₹${refund.amount} created. Reason: ${refund.reason}`,
        timestamp: refund.createdAt,
        actor: "admin",
        metadata: {
          refundId: refund.id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
        },
      });

      if (refund.status === "completed" && refund.processedAt) {
        events.push({
          type: TimelineEventType.REFUND_PROCESSED,
          title: "Refund Processed",
          description: `Refund of ₹${refund.amount} has been processed`,
          timestamp: refund.processedAt,
          actor: "system",
          metadata: {
            refundId: refund.id,
            providerRefundId: refund.providerRefundId,
          },
        });
      } else if (refund.status === "failed") {
        events.push({
          type: TimelineEventType.REFUND_PROCESSED,
          title: "Refund Failed",
          description: `Refund of ₹${refund.amount} failed to process`,
          timestamp: refund.updatedAt,
          actor: "system",
          metadata: {
            refundId: refund.id,
            status: refund.status,
          },
        });
      }
    }

    // Add shipment cancelled events
    for (const shipment of orderShipments) {
      if (shipment.status === "cancelled") {
        events.push({
          type: TimelineEventType.SHIPMENT_CANCELLED,
          title: "Shipment Cancelled",
          description: `Shipment ${shipment.awbNumber || shipment.trackingNumber || shipment.id} was cancelled`,
          timestamp: shipment.updatedAt,
          actor: "admin",
          metadata: {
            shipmentId: shipment.id,
            awbNumber: shipment.awbNumber,
            trackingNumber: shipment.trackingNumber,
          },
        });
      }
    }

    // Sort events by timestamp (oldest first)
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      currentStatus: order.status as
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded",
      events,
    };
  }

  /**
   * Add an event to the order timeline
   * Note: Currently events are generated dynamically from database records.
   * This method is a placeholder for future event storage implementation.
   * @param orderId - Order ID
   * @param event - Event to add
   */
  async addEvent(
    orderId: string,
    event: Omit<TimelineEventDto, "timestamp"> & { timestamp?: Date },
  ): Promise<void> {
    // Verify order exists
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Log the event for now (future: store in event table or JSONB field)
    this._logger.info(
      {
        orderId,
        eventType: event.type,
        actor: event.actor,
        actorId: event.actorId,
      },
      "Timeline event added",
    );

    // Future implementation: Store events in a separate table or JSONB field
    // For now, events are generated dynamically from database records
  }
}
