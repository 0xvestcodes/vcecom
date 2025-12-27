import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { addresses, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { calculateGstBreakdown } from "../../common/utils/gst.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { CheckoutState } from "../redis-store/constants/checkout-states";
import { CheckoutStore } from "../redis-store/stores/checkout-store";
import { OrderResponseDto } from "./dto/order-response.dto";
import { OrdersService } from "./orders.service";

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly checkoutStore: CheckoutStore,
    private readonly ordersService: OrdersService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Reprocess payment intent to create order
   * Safe to call multiple times - idempotent
   * @param paymentIntentId - Payment intent ID from provider (e.g., Razorpay order ID)
   * @param provider - Payment provider (default: "razorpay")
   * @returns Order if created or found, null if payment not confirmed
   */
  async reprocessPaymentIntent(
    paymentIntentId: string,
    provider: string = "razorpay",
  ): Promise<OrderResponseDto | null> {
    this.logger.info(
      `Reprocessing payment intent: paymentIntentId=${paymentIntentId}, provider=${provider}`,
    );

    // Check if order already exists (idempotent)
    const existingOrderId = await this.checkoutStore.getOrderByPaymentIntent(
      provider,
      paymentIntentId,
    );

    if (existingOrderId) {
      this.logger.info(
        `Order already exists for paymentIntentId=${paymentIntentId}, orderId=${existingOrderId}`,
      );
      // Fetch and return existing order directly from database
      // (bypassing user check since this is admin reconciliation)
      let order: typeof orders.$inferSelect | undefined;
      try {
        const orderResult = await this.db
          .select()
          .from(orders)
          .where(eq(orders.id, existingOrderId))
          .limit(1);
        order = orderResult[0];
      } catch (error) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "ReconciliationService.reprocessPaymentIntent.selectOrder",
            error,
            { existingOrderId, paymentIntentId },
          ),
          "Failed to fetch existing order",
        );
        throw new NotFoundException(
          `Order ${existingOrderId} not found for payment intent ${paymentIntentId}`,
        );
      }

      if (!order) {
        throw new NotFoundException(
          `Order ${existingOrderId} not found for payment intent ${paymentIntentId}`,
        );
      }

      // Get order items with explicit field selection
      let items: Array<{
        id: string;
        orderId: string;
        productVariantId: string;
        quantity: number;
        price: number;
        gstRate: number;
        gstAmount: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
      try {
        items = await this.db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productVariantId: orderItems.productVariantId,
            quantity: orderItems.quantity,
            price: orderItems.price,
            gstRate: orderItems.gstRate,
            gstAmount: orderItems.gstAmount,
            createdAt: orderItems.createdAt,
            updatedAt: orderItems.updatedAt,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "ReconciliationService.reprocessPaymentIntent.selectItems",
            {
              orderId: existingOrderId,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to fetch order items",
        );
        items = [];
      }

      // Get shipping address for GST calculation
      let shippingAddress: { state: string } | undefined;
      try {
        const addressResult = await this.db
          .select({ state: addresses.state })
          .from(addresses)
          .where(eq(addresses.id, order.shippingAddressId))
          .limit(1);
        shippingAddress = addressResult[0];
      } catch (error) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "ReconciliationService.reprocessPaymentIntent.selectAddress",
            {
              orderId: existingOrderId,
              shippingAddressId: order.shippingAddressId,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
          "Failed to fetch shipping address, using default state",
        );
        shippingAddress = undefined;
      }

      // Calculate GST breakdown
      const sellerState = "Maharashtra";
      const buyerState = shippingAddress?.state || "";

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
              "ReconciliationService.reprocessPaymentIntent.calculateGst",
              {
                orderId: existingOrderId,
                itemId: item.id,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to calculate GST for item, skipping",
          );
        }
      }

      const gstBreakdown = {
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        totalGst: order.gstAmount || 0,
        isIntraState: sellerState === buyerState,
      };

      // Validate and parse payment fee breakdown
      let paymentFeeBreakdown:
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
        | undefined = null;

      if (order.paymentFeeBreakdown) {
        try {
          const parsed =
            typeof order.paymentFeeBreakdown === "string"
              ? JSON.parse(order.paymentFeeBreakdown)
              : order.paymentFeeBreakdown;

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
            paymentFeeBreakdown = parsed as {
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
              "ReconciliationService.reprocessPaymentIntent.parsePaymentFeeBreakdown",
              {
                orderId: existingOrderId,
                error: error instanceof Error ? error.message : String(error),
              },
            ),
            "Failed to parse payment fee breakdown",
          );
        }
      }

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
    }

    // Find checkout session via payment intent
    let checkoutSessionId: string | null = null;

    // Try reverse lookup
    try {
      const reverseKey = `payment:intent:by-id:${paymentIntentId}`;
      checkoutSessionId = await this.checkoutStore.get<string>(reverseKey);
    } catch (error) {
      this.logger.warn(
        `Failed to get checkoutSessionId via reverse lookup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    if (!checkoutSessionId) {
      throw new NotFoundException(
        `Checkout session not found for payment intent ${paymentIntentId}`,
      );
    }

    // Get checkout session
    const session = await this.checkoutStore.getSession(checkoutSessionId);
    if (!session) {
      throw new NotFoundException(
        `Checkout session ${checkoutSessionId} not found`,
      );
    }

    // Check payment intent status
    const paymentIntent =
      await this.checkoutStore.getPaymentIntent(checkoutSessionId);
    if (!paymentIntent) {
      throw new NotFoundException(
        `Payment intent not found for checkout session ${checkoutSessionId}`,
      );
    }

    // Only proceed if payment is confirmed
    if (paymentIntent.status !== "CONFIRMED") {
      this.logger.warn(
        `Payment intent ${paymentIntentId} is not confirmed (status: ${paymentIntent.status}). Cannot create order.`,
      );
      return null;
    }

    // Validate checkout state
    if (
      session.state !== CheckoutState.PAYMENT_CONFIRMED &&
      session.state !== CheckoutState.PAYMENT_PENDING
    ) {
      if (session.state === CheckoutState.COMPLETED) {
        // Order should exist but doesn't - this is an inconsistency
        throw new BadRequestException(
          `Checkout session is COMPLETED but order not found. This indicates a data inconsistency.`,
        );
      }
      throw new BadRequestException(
        `Cannot create order: checkout session is in state ${session.state}, expected PAYMENT_CONFIRMED or PAYMENT_PENDING`,
      );
    }

    // Ensure state is PAYMENT_CONFIRMED
    if (session.state === CheckoutState.PAYMENT_PENDING) {
      try {
        await this.checkoutStore.transitionState(
          checkoutSessionId,
          CheckoutState.PAYMENT_PENDING,
          CheckoutState.PAYMENT_CONFIRMED,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to transition to PAYMENT_CONFIRMED: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        // Continue - payment is confirmed, we can still create order
      }
    }

    // Create order from payment (idempotent)
    try {
      const order = await this.ordersService.finalizeOrderFromPayment(
        checkoutSessionId,
        paymentIntentId,
        provider,
      );

      this.logger.info(
        `Successfully reprocessed payment intent: paymentIntentId=${paymentIntentId}, orderId=${order.id}`,
      );

      return order;
    } catch (error) {
      this.logger.error(
        `Failed to reprocess payment intent ${paymentIntentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }
}
