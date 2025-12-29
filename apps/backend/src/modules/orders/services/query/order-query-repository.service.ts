import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import { createErrorContext } from "../../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../../modules/database/database.module";
import type { Database } from "../../../../modules/database/db";
import { OrderStatus } from "../../dto/update-order-status.dto";

/**
 * Repository service responsible for database queries related to orders
 * Handles all direct database access for order and order item queries
 */
@Injectable()
export class OrderQueryRepositoryService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Fetch order by ID and customer ID
   * @param orderId - Order ID
   * @param customerId - Customer ID
   * @returns Order or undefined if not found
   */
  async fetchOrderByIdAndCustomer(
    orderId: string,
    customerId: string,
  ): Promise<typeof orders.$inferSelect | undefined> {
    try {
      const orderResult = await this.db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
        .limit(1);
      return orderResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderQueryRepositoryService.fetchOrderByIdAndCustomer",
          error,
          { orderId, customerId },
        ),
        "Failed to fetch order",
      );
      throw new NotFoundException("Order not found");
    }
  }

  /**
   * Fetch order by ID
   * @param orderId - Order ID
   * @returns Order or undefined if not found
   */
  async fetchOrderById(
    orderId: string,
  ): Promise<typeof orders.$inferSelect | undefined> {
    try {
      const orderResult = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      return orderResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderQueryRepositoryService.fetchOrderById",
          error,
          { orderId },
        ),
        "Failed to fetch order",
      );
      throw new NotFoundException("Order not found");
    }
  }

  /**
   * Fetch orders by customer ID
   * @param customerId - Customer ID
   * @param status - Optional status filter
   * @returns Array of orders
   */
  async fetchOrdersByCustomer(
    customerId: string,
    status?: OrderStatus,
  ): Promise<Array<typeof orders.$inferSelect>> {
    try {
      const conditions = [eq(orders.customerId, customerId)];
      if (status) {
        conditions.push(eq(orders.status, status));
      }

      return await this.db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderQueryRepositoryService.fetchOrdersByCustomer",
          error,
          { customerId, status },
        ),
        "Failed to fetch orders",
      );
      return [];
    }
  }

  /**
   * Fetch order items for an order
   * @param orderId - Order ID
   * @param includeMetadata - Whether to include metadata field
   * @returns Array of order items
   */
  async fetchOrderItems(
    orderId: string,
    includeMetadata: boolean = true,
  ): Promise<
    Array<{
      id: string;
      orderId: string;
      productVariantId: string;
      quantity: number;
      price: number;
      gstRate: number;
      gstAmount: number;
      metadata?: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    try {
      const selectFields: {
        id: typeof orderItems.id;
        orderId: typeof orderItems.orderId;
        productVariantId: typeof orderItems.productVariantId;
        quantity: typeof orderItems.quantity;
        price: typeof orderItems.price;
        gstRate: typeof orderItems.gstRate;
        gstAmount: typeof orderItems.gstAmount;
        createdAt: typeof orderItems.createdAt;
        updatedAt: typeof orderItems.updatedAt;
        metadata?: typeof orderItems.metadata;
      } = {
        id: orderItems.id,
        orderId: orderItems.orderId,
        productVariantId: orderItems.productVariantId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        gstRate: orderItems.gstRate,
        gstAmount: orderItems.gstAmount,
        createdAt: orderItems.createdAt,
        updatedAt: orderItems.updatedAt,
      };

      if (includeMetadata) {
        selectFields.metadata = orderItems.metadata;
      }

      const items = await this.db
        .select(selectFields)
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      // Ensure metadata is always present (even if undefined)
      return items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        price: item.price,
        gstRate: item.gstRate,
        gstAmount: item.gstAmount,
        metadata: includeMetadata
          ? "metadata" in item
            ? (item.metadata ?? null)
            : null
          : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderQueryRepositoryService.fetchOrderItems",
          error,
          { orderId },
        ),
        "Failed to fetch order items",
      );
      return [];
    }
  }
}
