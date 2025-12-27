import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { OrderResponseDto } from "../dto/order-response.dto";
import { TimelineEventType } from "../dto/order-timeline.dto";
import { OrderGstService } from "./order-gst.service";
import { OrderTimelineService } from "./order-timeline.service";
import { OrderValidationService } from "./order-validation.service";

/**
 * Service responsible for order archiving
 * Handles archiving and unarchiving orders for customers and admins
 */
@Injectable()
export class OrderArchiveService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly validationService: OrderValidationService,
    private readonly timelineService: OrderTimelineService,
    private readonly gstService: OrderGstService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Archive order (customer)
   * @param userId - User ID
   * @param orderId - Order ID
   * @returns Updated order
   */
  async archiveOrder(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const customerId = await this.validationService.getCustomerId(userId);

    // Get order and validate ownership
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.archived) {
      throw new BadRequestException("Order is already archived");
    }

    return this.processArchive(orderId, order, customerId, false);
  }

  /**
   * Archive order (admin)
   * @param orderId - Order ID
   * @param adminId - Admin user ID
   * @returns Updated order
   */
  async archiveOrderForAdmin(
    orderId: string,
    adminId: string,
  ): Promise<OrderResponseDto> {
    // Get order (no customer validation for admin)
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.archived) {
      throw new BadRequestException("Order is already archived");
    }

    return this.processArchive(orderId, order, adminId, true);
  }

  /**
   * Unarchive order (customer)
   * @param userId - User ID
   * @param orderId - Order ID
   * @returns Updated order
   */
  async unarchiveOrder(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const customerId = await this.validationService.getCustomerId(userId);

    // Get order and validate ownership
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (!order.archived) {
      throw new BadRequestException("Order is not archived");
    }

    return this.processUnarchive(orderId, order, false);
  }

  /**
   * Unarchive order (admin)
   * @param orderId - Order ID
   * @returns Updated order
   */
  async unarchiveOrderForAdmin(orderId: string): Promise<OrderResponseDto> {
    // Get order (no customer validation for admin)
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (!order.archived) {
      throw new BadRequestException("Order is not archived");
    }

    return this.processUnarchive(orderId, order, true);
  }

  /**
   * Process order archiving
   * @param orderId - Order ID
   * @param order - Order object
   * @param archivedBy - User ID who archived
   * @param isAdmin - Whether actor is admin
   * @returns Updated order
   */
  private async processArchive(
    orderId: string,
    order: typeof orders.$inferSelect,
    archivedBy: string,
    isAdmin: boolean,
  ): Promise<OrderResponseDto> {
    // Update order archive status
    const [updatedOrder] = await this.db
      .update(orders)
      .set({
        archived: true,
        archivedAt: new Date(),
        archivedBy,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Create timeline event
    await this.timelineService.addEvent(orderId, {
      type: TimelineEventType.STATUS_CHANGED,
      title: "Order Archived",
      description: `Order has been archived${isAdmin ? " by admin" : ""}`,
      actor: isAdmin ? "admin" : "customer",
      actorId: archivedBy,
      timestamp: new Date(),
      metadata: {
        previousArchived: false,
        archived: true,
      },
    });

    // Get order items
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Get GST breakdown
    const gstBreakdown = await this.gstService.calculateOrderGstBreakdown(
      orderId,
      updatedOrder.shippingAddressId,
    );

    this.logger.info(
      createLogContext(this.contextService, "archiveOrder", {
        orderId,
        orderNumber: order.orderNumber,
        archivedBy,
        isAdmin,
      }),
      "Order archived successfully",
    );

    return {
      ...updatedOrder,
      gstBreakdown,
      items,
    } as OrderResponseDto;
  }

  /**
   * Process order unarchiving
   * @param orderId - Order ID
   * @param order - Order object
   * @param isAdmin - Whether actor is admin
   * @returns Updated order
   */
  private async processUnarchive(
    orderId: string,
    order: typeof orders.$inferSelect,
    isAdmin: boolean,
  ): Promise<OrderResponseDto> {
    // Update order archive status
    const [updatedOrder] = await this.db
      .update(orders)
      .set({
        archived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Create timeline event
    await this.timelineService.addEvent(orderId, {
      type: TimelineEventType.STATUS_CHANGED,
      title: "Order Unarchived",
      description: `Order has been unarchived${isAdmin ? " by admin" : ""}`,
      actor: isAdmin ? "admin" : "customer",
      timestamp: new Date(),
      metadata: {
        previousArchived: true,
        archived: false,
      },
    });

    // Get order items
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Get GST breakdown
    const gstBreakdown = await this.gstService.calculateOrderGstBreakdown(
      orderId,
      updatedOrder.shippingAddressId,
    );

    this.logger.info(
      createLogContext(this.contextService, "unarchiveOrder", {
        orderId,
        orderNumber: order.orderNumber,
        isAdmin,
      }),
      "Order unarchived successfully",
    );

    return {
      ...updatedOrder,
      gstBreakdown,
      items,
    } as OrderResponseDto;
  }
}
