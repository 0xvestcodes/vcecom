import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../common/logging/logging.helper";
import { calculateGstBreakdown } from "../../../common/utils/gst.utils";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { OrderResponseDto } from "../dto/order-response.dto";
import { OrderStatus } from "../dto/update-order-status.dto";
import { OrderEnrichmentService } from "./order-enrichment.service";
import { OrderGstService } from "./order-gst.service";
import { OrderValidationService } from "./validation/order-validation.service";

/**
 * Service responsible for querying orders
 * Handles fetching orders, order items, and building response DTOs
 */
@Injectable()
export class OrderQueryService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly validationService: OrderValidationService,
    private readonly enrichmentService: OrderEnrichmentService,
    readonly _gstService: OrderGstService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Get order by ID (for authenticated customer)
   * @param userId - User ID
   * @param orderId - Order ID
   * @returns Order with enriched data
   */
  async findOne(userId: string, orderId: string): Promise<OrderResponseDto> {
    try {
      const customerId = await this.validationService.getCustomerId(userId);

      // Fetch order
      const order = await this.fetchOrderByIdAndCustomer(orderId, customerId);
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Fetch order items
      const items = await this.fetchOrderItems(orderId);

      // Get addresses and calculate GST
      const {
        shippingAddress: shippingAddressData,
        billingAddress: billingAddressData,
      } = await this.enrichmentService.fetchOrderAddresses(
        order.shippingAddressId,
        order.billingAddressId,
      );

      const shippingAddressState = shippingAddressData?.state;
      const sellerState = this.validationService.getSellerState();
      const buyerState = shippingAddressState || "";

      // Calculate GST breakdown
      const gstBreakdown = await this.calculateOrderGstBreakdown(
        items,
        order.gstAmount || 0,
        sellerState,
        buyerState,
        orderId,
      );

      // Parse payment fee breakdown
      const paymentFeeBreakdown = this.parsePaymentFeeBreakdown(
        order.paymentFeeBreakdown,
        orderId,
      );

      // Enrich order items with product data
      // Ensure metadata is always present for enrichment
      const itemsWithMetadata = items.map((item) => ({
        ...item,
        metadata: "metadata" in item ? (item.metadata ?? null) : null,
      }));
      const enrichedItems = await this.enrichmentService.enrichOrderItems(
        itemsWithMetadata,
        sellerState,
        buyerState,
      );

      // Get payment details
      const paymentDetails = await this.enrichmentService.buildPaymentDetails(
        order,
        paymentFeeBreakdown,
      );

      // Build shipping details
      const shippingDetails =
        this.enrichmentService.buildShippingDetails(order);

      return {
        id: order.id,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal || 0,
        gstAmount: order.gstAmount || 0,
        gstBreakdown,
        shippingCost: order.shippingCost || 0,
        paymentFee: order.paymentFee || undefined,
        paymentMethod: order.paymentMethod || null,
        paymentFeeBreakdown,
        total: order.total || 0,
        razorpayOrderId: order.razorpayOrderId || null,
        shippingProvider: order.shippingProvider || null,
        shippingAddressId: order.shippingAddressId,
        billingAddressId: order.billingAddressId,
        items: enrichedItems,
        shippingAddress:
          this.enrichmentService.transformAddressToResponse(
            shippingAddressData,
          ),
        billingAddress:
          this.enrichmentService.transformAddressToResponse(billingAddressData),
        paymentDetails,
        shippingDetails,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        archived: order.archived || false,
        archivedAt: order.archivedAt || null,
        archivedBy: order.archivedBy || null,
        ...(order.discountCode !== null && order.discountCode !== undefined
          ? { discountCode: order.discountCode }
          : {}),
        ...(order.discountAmount !== null && order.discountAmount !== undefined
          ? { discountAmount: order.discountAmount }
          : {}),
      } as OrderResponseDto & {
        discountCode?: string | null;
        discountAmount?: number;
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderQueryService.findOne",
          error,
          {
            orderId,
            userId,
          },
        ),
        "Failed to get order",
      );
      throw new NotFoundException("Order not found");
    }
  }

  /**
   * Get order by ID (public - for guest orders)
   * @param orderId - Order ID
   * @returns Order with basic data (no enriched items)
   */
  async findOnePublic(orderId: string): Promise<OrderResponseDto> {
    try {
      // Fetch order
      const order = await this.fetchOrderById(orderId);
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Fetch order items
      const items = await this.fetchOrderItems(orderId, false);

      // Get shipping address for GST calculation
      const shippingAddressState =
        await this.enrichmentService.fetchShippingAddressState(
          order.shippingAddressId,
        );
      const shippingAddress = shippingAddressState
        ? { state: shippingAddressState }
        : undefined;

      // Calculate GST breakdown
      const sellerState = this.validationService.getSellerState();
      const buyerState = shippingAddress?.state || "";

      const gstBreakdown = await this.calculateOrderGstBreakdown(
        items,
        order.gstAmount || 0,
        sellerState,
        buyerState,
        orderId,
      );

      // Parse payment fee breakdown
      const paymentFeeBreakdown = this.parsePaymentFeeBreakdown(
        order.paymentFeeBreakdown,
        orderId,
      );

      return {
        id: order.id,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal || 0,
        gstAmount: order.gstAmount || 0,
        gstBreakdown,
        shippingCost: order.shippingCost || 0,
        paymentFee: order.paymentFee || undefined,
        paymentMethod: order.paymentMethod || null,
        paymentFeeBreakdown,
        total: order.total || 0,
        razorpayOrderId: order.razorpayOrderId || null,
        shippingProvider: order.shippingProvider || null,
        shippingAddressId: order.shippingAddressId,
        billingAddressId: order.billingAddressId,
        items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        archived: order.archived || false,
        archivedAt: order.archivedAt || null,
        archivedBy: order.archivedBy || null,
        ...(order.discountCode !== null && order.discountCode !== undefined
          ? { discountCode: order.discountCode }
          : {}),
        ...(order.discountAmount !== null && order.discountAmount !== undefined
          ? { discountAmount: order.discountAmount }
          : {}),
      } as OrderResponseDto & {
        discountCode?: string | null;
        discountAmount?: number;
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderQueryService.findOnePublic",
          error,
          { orderId },
        ),
        "Failed to get order",
      );
      throw new NotFoundException("Order not found");
    }
  }

  /**
   * Get all orders for a customer
   * @param userId - User ID
   * @param status - Optional status filter
   * @returns List of orders
   */
  async findAll(
    userId: string,
    status?: OrderStatus,
  ): Promise<Array<OrderResponseDto>> {
    try {
      const customerId = await this.validationService.getCustomerId(userId);

      // Fetch orders
      const ordersList = await this.fetchOrdersByCustomer(customerId, status);

      // Process each order with items and enrichment
      const ordersWithItems = await Promise.all(
        ordersList.map(async (order) => {
          try {
            // Fetch order items
            const items = await this.fetchOrderItems(order.id, false);

            // Get shipping address for GST calculation
            const shippingAddressState =
              await this.enrichmentService.fetchShippingAddressState(
                order.shippingAddressId,
              );
            const shippingAddress = shippingAddressState
              ? { state: shippingAddressState }
              : undefined;

            // Calculate GST breakdown
            const sellerState = this.validationService.getSellerState();
            const buyerState = shippingAddress?.state || "";

            let gstBreakdown:
              | {
                  cgst: number;
                  sgst: number;
                  igst: number;
                  totalGst: number;
                  isIntraState: boolean;
                }
              | undefined;
            try {
              gstBreakdown = await this.calculateOrderGstBreakdown(
                items,
                order.gstAmount || 0,
                sellerState,
                buyerState,
                order.id,
              );
            } catch (error) {
              this.logger.warn(
                createLogContext(
                  this.contextService,
                  "OrderQueryService.findAll.calculateGst",
                  {
                    orderId: order.id,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                ),
                "Failed to calculate GST breakdown, using defaults",
              );
              gstBreakdown = {
                cgst: 0,
                sgst: 0,
                igst: 0,
                totalGst: order.gstAmount || 0,
                isIntraState: false,
              };
            }

            // Parse payment fee breakdown
            const paymentFeeBreakdown = this.parsePaymentFeeBreakdown(
              order.paymentFeeBreakdown,
              order.id,
            );

            return {
              id: order.id,
              customerId: order.customerId,
              orderNumber: order.orderNumber,
              status: order.status,
              subtotal: order.subtotal || 0,
              gstAmount: order.gstAmount || 0,
              gstBreakdown,
              shippingCost: order.shippingCost || 0,
              paymentFee: order.paymentFee || undefined,
              paymentMethod: order.paymentMethod || null,
              paymentFeeBreakdown,
              total: order.total || 0,
              razorpayOrderId: order.razorpayOrderId || null,
              shippingProvider: order.shippingProvider || null,
              shippingAddressId: order.shippingAddressId,
              billingAddressId: order.billingAddressId,
              items,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              archived: order.archived || false,
              archivedAt: order.archivedAt || null,
              archivedBy: order.archivedBy || null,
              ...(order.discountCode !== null &&
              order.discountCode !== undefined
                ? { discountCode: order.discountCode }
                : {}),
              ...(order.discountAmount !== null &&
              order.discountAmount !== undefined
                ? { discountAmount: order.discountAmount }
                : {}),
            } as OrderResponseDto & {
              discountCode?: string | null;
              discountAmount?: number;
            };
          } catch (error) {
            this.logger.error(
              createErrorContext(
                this.contextService,
                "OrderQueryService.findAll.processOrder",
                error,
                { orderId: order.id },
              ),
              "Failed to process order in findAll",
            );
            // Return minimal order to prevent complete failure
            return this.buildMinimalOrderResponse(order);
          }
        }),
      );

      return ordersWithItems;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "OrderQueryService.findAll",
          error,
          {
            userId,
            status,
          },
        ),
        "Failed to get orders",
      );
      return [];
    }
  }

  /**
   * Fetch order by ID and customer ID
   * @private
   */
  private async fetchOrderByIdAndCustomer(
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
          "OrderQueryService.fetchOrderByIdAndCustomer",
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
   * @private
   */
  private async fetchOrderById(
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
          "OrderQueryService.fetchOrderById",
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
   * @private
   */
  private async fetchOrdersByCustomer(
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
          "OrderQueryService.fetchOrdersByCustomer",
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
   * @private
   */
  private async fetchOrderItems(
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
          "OrderQueryService.fetchOrderItems",
          error,
          { orderId },
        ),
        "Failed to fetch order items",
      );
      return [];
    }
  }

  /**
   * Calculate GST breakdown for an order
   * @private
   */
  private async calculateOrderGstBreakdown(
    items: Array<{
      price: number;
      quantity: number;
      gstRate: number;
    }>,
    totalGstAmount: number,
    sellerState: string,
    buyerState: string,
    orderId: string,
  ): Promise<{
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    isIntraState: boolean;
  }> {
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of items) {
      try {
        const itemSubtotal = item.price * item.quantity;
        const gstBreakdown = calculateGstBreakdown(
          itemSubtotal,
          item.gstRate,
          sellerState,
          buyerState,
        );
        totalCgst += gstBreakdown.cgst;
        totalSgst += gstBreakdown.sgst;
        totalIgst += gstBreakdown.igst;
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "OrderQueryService.calculateOrderGstBreakdown",
            {
              orderId,
              itemId: item,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to calculate GST for item, skipping",
        );
      }
    }

    return {
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalGst: totalGstAmount,
      isIntraState: sellerState === buyerState,
    };
  }

  /**
   * Parse payment fee breakdown from order
   * @private
   */
  private parsePaymentFeeBreakdown(
    paymentFeeBreakdown: unknown,
    orderId: string,
  ):
    | {
        method: string;
        chargeType: string;
        calculatedFee: number;
        flatAmount?: number;
        percentage?: number;
        mixMin?: number;
        mixCap?: number;
      }
    | null
    | undefined {
    if (!paymentFeeBreakdown) {
      return null;
    }

    try {
      const parsed =
        typeof paymentFeeBreakdown === "string"
          ? JSON.parse(paymentFeeBreakdown)
          : paymentFeeBreakdown;

      if (
        parsed &&
        typeof parsed === "object" &&
        "method" in parsed &&
        "chargeType" in parsed &&
        "calculatedFee" in parsed &&
        typeof parsed.method === "string" &&
        typeof parsed.chargeType === "string" &&
        typeof parsed.calculatedFee === "number"
      ) {
        return parsed as {
          method: string;
          chargeType: string;
          calculatedFee: number;
          flatAmount?: number;
          percentage?: number;
          mixMin?: number;
          mixCap?: number;
        };
      }
    } catch (error) {
      this.logger.warn(
        createLogContext(
          this.contextService,
          "OrderQueryService.parsePaymentFeeBreakdown",
          {
            orderId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
        "Failed to parse payment fee breakdown",
      );
    }

    return null;
  }

  /**
   * Build minimal order response for error cases
   * @private
   */
  private buildMinimalOrderResponse(
    order: typeof orders.$inferSelect,
  ): OrderResponseDto & {
    discountCode?: string | null;
    discountAmount?: number;
  } {
    return {
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: order.subtotal || 0,
      gstAmount: order.gstAmount || 0,
      gstBreakdown: {
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalGst: order.gstAmount || 0,
        isIntraState: false,
      },
      shippingCost: order.shippingCost || 0,
      paymentFee: order.paymentFee || undefined,
      paymentMethod: order.paymentMethod || null,
      paymentFeeBreakdown: null,
      total: order.total || 0,
      razorpayOrderId: order.razorpayOrderId || null,
      shippingProvider: order.shippingProvider || null,
      shippingAddressId: order.shippingAddressId,
      billingAddressId: order.billingAddressId,
      items: [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      archived: order.archived || false,
      archivedAt: order.archivedAt || null,
      archivedBy: order.archivedBy || null,
      ...(order.discountCode !== null && order.discountCode !== undefined
        ? { discountCode: order.discountCode }
        : {}),
      ...(order.discountAmount !== null && order.discountAmount !== undefined
        ? { discountAmount: order.discountAmount }
        : {}),
    };
  }
}
