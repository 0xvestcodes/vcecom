import { Injectable, NotFoundException } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { calculateGstBreakdown } from "../../../../common/utils/gst.utils";
import { orders } from "@vcecom/db";
import { OrderResponseDto } from "../../dto/order-response.dto";
import { OrderStatus } from "../../dto/update-order-status.dto";
import { OrderGstService } from "../gst/order-gst.service";
import { OrderValidationService } from "../validation/order-validation.service";
import { OrderEnrichmentService } from "./order-enrichment.service";
import { OrderQueryRepositoryService } from "./order-query-repository.service";

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
    private readonly repositoryService: OrderQueryRepositoryService,
    readonly _gstService: OrderGstService,
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
      const order = await this.repositoryService.fetchOrderByIdAndCustomer(
        orderId,
        customerId,
      );
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Fetch order items
      const items = await this.repositoryService.fetchOrderItems(orderId);

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
      const order = await this.repositoryService.fetchOrderById(orderId);
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Fetch order items
      const items = await this.repositoryService.fetchOrderItems(
        orderId,
        false,
      );

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
      const ordersList =
        await this.repositoryService.fetchOrdersByCustomer(customerId, status);

      // Process each order with items and enrichment
      const ordersWithItems = await Promise.all(
        ordersList.map(async (order) => {
          try {
            // Fetch order items
            const items = await this.repositoryService.fetchOrderItems(
              order.id,
              false,
            );

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
