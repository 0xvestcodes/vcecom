import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, orders, shipments } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { OrderTrackingDto } from "../dto/order-tracking.dto";
import { OrderValidationService } from "./validation/order-validation.service";

/**
 * Service responsible for order shipment tracking
 * Handles shipment tracking information and status
 */
@Injectable()
export class OrderTrackingService {
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
   * Get order tracking information (admin - no user validation)
   * @param orderId - Order ID
   * @returns Order tracking information with shipments
   * @throws NotFoundException if order not found
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
}
