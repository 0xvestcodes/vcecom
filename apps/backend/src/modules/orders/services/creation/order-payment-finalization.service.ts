import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  addresses,
  cartItems,
  eq,
  inArray,
  orderItems,
  products,
  productVariants,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { PAISE_PER_RUPEE } from "../../../../common/constants/currency.constants";
import { ContextService } from "../../../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { CartsService } from "../../../carts/carts.service";
import { AbandonedCartRecoveryService } from "../../../carts/services/abandoned-cart-recovery.service";
import { DB_TOKEN } from "../../../database/database.module";
import {
  OrderCreatedEventPayload,
  OrderPaymentCompletedEventPayload,
} from "../../../events/order-events.types";
import { FraudDetectionService } from "../../../fraud-detection/fraud-detection.service";
import { PaymentFeeBreakdownDto } from "../../../payments/dto/payment-charge.dto";
import { CheckoutState } from "../../../redis-store/constants/checkout-states";
import { LoyaltyService } from "../../../wallet/services/loyalty.service";
import { OrderResponseDto } from "../../dto/order-response.dto";
import { OrderCalculationService } from "../calculation/order-calculation.service";
import { OrderTotalsCalculationService } from "../calculation/order-totals-calculation.service";
import { OrderCartCleanupService } from "../cart/order-cart-cleanup.service";
import { OrderCartProcessingService } from "../cart/order-cart-processing.service";
import { OrderCartValidationService } from "../cart/order-cart-validation.service";
import { OrderCheckoutSessionService } from "../checkout/order-checkout-session.service";
import { OrderStateTransitionService } from "../checkout/order-state-transition.service";
import { OrderDiscountService } from "../discount/order-discount.service";
import { OrderDiscountExtractionService } from "../discount/order-discount-extraction.service";
import { OrderDiscountUsageService } from "../discount/order-discount-usage.service";
import { OrderEventOrchestrationService } from "../events/order-event-orchestration.service";
import { OrderIdempotencyService } from "../idempotency/order-idempotency.service";
import { OrderInventoryService } from "../inventory/order-inventory.service";
import { OrderNotificationService } from "../notifications/order-notification.service";
import { OrderPersistenceService } from "../persistence/order-persistence.service";
import { OrderPricingDriftService } from "../pricing/order-pricing-drift.service";
import { OrderResponseBuilderService } from "../query/order-response-builder.service";
import { OrderPricingSnapshotService } from "../snapshot/order-pricing-snapshot.service";
import { OrderSnapshotAuditService } from "../snapshot/order-snapshot-audit.service";
import { OrderSnapshotValidationService } from "../snapshot/order-snapshot-validation.service";
import { OrderValidationService } from "../validation/order-validation.service";

/**
 * Service responsible for finalizing orders from payment confirmation
 * Handles the complete order creation flow after payment is confirmed via webhook
 */
@Injectable()
export class OrderPaymentFinalizationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly cartsService: CartsService,
    private readonly abandonedCartRecoveryService: AbandonedCartRecoveryService,
    private readonly inventoryService: OrderInventoryService,
    private readonly checkoutSessionService: OrderCheckoutSessionService,
    private readonly validationService: OrderValidationService,
    private readonly cartValidationService: OrderCartValidationService,
    private readonly calculationService: OrderCalculationService,
    private readonly totalsCalculationService: OrderTotalsCalculationService,
    private readonly cartProcessingService: OrderCartProcessingService,
    private readonly cartCleanupService: OrderCartCleanupService,
    private readonly persistenceService: OrderPersistenceService,
    private readonly pricingSnapshotService: OrderPricingSnapshotService,
    private readonly snapshotValidationService: OrderSnapshotValidationService,
    private readonly snapshotAuditService: OrderSnapshotAuditService,
    private readonly pricingDriftService: OrderPricingDriftService,
    private readonly discountExtractionService: OrderDiscountExtractionService,
    private readonly discountService: OrderDiscountService,
    private readonly discountUsageService: OrderDiscountUsageService,
    private readonly stateTransitionService: OrderStateTransitionService,
    private readonly notificationService: OrderNotificationService,
    private readonly eventOrchestrationService: OrderEventOrchestrationService,
    private readonly responseBuilderService: OrderResponseBuilderService,
    private readonly idempotencyService: OrderIdempotencyService,
    private readonly fraudDetectionService: FraudDetectionService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly loyaltyService?: LoyaltyService,
  ) {}

  /**
   * Finalize order from payment confirmation (webhook-driven)
   * Creates order only after payment is confirmed
   * Uses payment-scoped idempotency to prevent duplicate orders
   */
  @Trace({
    operation: "OrderPaymentFinalizationService.finalizeOrderFromPayment",
  })
  async finalizeOrderFromPayment(
    checkoutSessionId: string,
    paymentIntentId: string,
    provider: string = "razorpay",
  ): Promise<OrderResponseDto> {
    // Check payment-scoped idempotency first
    const existingOrder = await this.idempotencyService.checkExistingOrder(
      checkoutSessionId,
      paymentIntentId,
      provider,
    );

    if (existingOrder) {
      return existingOrder;
    }

    // Get checkout session and validate state
    const session = await this.checkoutSessionService.getSession(
      checkoutSessionId,
      CheckoutState.PAYMENT_CONFIRMED,
    );

    // Get checkout metadata
    const metadata =
      await this.checkoutSessionService.getMetadata(checkoutSessionId);

    // Use customerId from metadata (required field)
    const customerId = metadata.customerId;

    // Validate cart and get cart data
    const cart = await this.cartsService.getCartById(session.cartId);
    this.cartValidationService.validateCartNotEmpty(
      cart as { id: string; items?: Array<{ id: string }> | null } | null,
    );

    // Get and validate cart items
    const _cartItemIds = cart.items?.map((item) => item.id);
    const allCartItems =
      await this.cartValidationService.validateAndFetchCartItems(
        session.cartId,
      );

    // Separate bundle and variant items
    const { bundleItems: bundleCartItems, variantItems: variantCartItems } =
      this.cartProcessingService.separateBundleAndVariantItems(allCartItems);

    // Get variant items with product details
    const variantItemIds = variantCartItems.map((i) => i.id);
    const cartItemsWithVariantsResult =
      variantItemIds.length > 0
        ? await this.db
            .select({
              cartItemId: cartItems.id,
              productVariantId: cartItems.productVariantId,
              quantity: cartItems.quantity,
              price: cartItems.price,
              productGstRate: products.gstRate,
            })
            .from(cartItems)
            .innerJoin(
              productVariants,
              eq(cartItems.productVariantId, productVariants.id),
            )
            .innerJoin(products, eq(productVariants.productId, products.id))
            .where(inArray(cartItems.id, variantItemIds))
        : [];

    const cartItemsWithVariants = Array.isArray(cartItemsWithVariantsResult)
      ? cartItemsWithVariantsResult
      : [];

    // Get shipping address for GST calculation
    const [shippingAddress] = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.id, metadata.shippingAddressId))
      .limit(1);

    if (!shippingAddress) {
      throw new NotFoundException("Shipping address not found");
    }

    // Calculate totals from cart items
    const buyerState = shippingAddress.state;
    const totals =
      await this.totalsCalculationService.calculateTotalsFromCartItems(
        cartItemsWithVariants,
        buyerState,
      );
    const { subtotal, totalGstAmount } = totals;
    const shippingCost = metadata.shippingCost;

    // Validate and extract discount information from snapshot
    let discountAmount = 0;
    let discountCode: string | null = null;
    if (metadata.discountSnapshot) {
      const snapshotTotal =
        metadata.discountSnapshot.total + totalGstAmount + shippingCost;
      await this.snapshotValidationService.validateDiscountSnapshot(
        checkoutSessionId,
        metadata.discountSnapshot,
        snapshotTotal,
      );
      const discountInfo = this.discountExtractionService.extractDiscountInfo(
        metadata.discountSnapshot,
      );
      discountAmount = discountInfo.discountAmount;
      discountCode = discountInfo.discountCode;
    } else {
      // Fallback: if snapshot not available, log warning but continue
      this.logger.warn(
        createLogContext(this.contextService, "finalizeOrderFromPayment", {
          checkoutSessionId,
        }),
        "Discount snapshot not found in checkout metadata, using 0 discount",
      );
    }

    // Validate pricing snapshot and get effective subtotal
    const pricingValidation =
      await this.snapshotValidationService.validatePricingSnapshot(
        checkoutSessionId,
        metadata.pricingSnapshot,
        subtotal,
      );
    const finalSubtotal = pricingValidation.effectiveSubtotal;
    const discountResult = metadata.discountSnapshot
      ? this.calculationService.applyDiscountSnapshot(
          finalSubtotal,
          metadata.discountSnapshot,
        )
      : {
          subtotalAfterDiscount: finalSubtotal,
          discountAmount: 0,
          discountCode: null,
        };
    const subtotalAfterDiscount = discountResult.subtotalAfterDiscount;
    if (metadata.discountSnapshot) {
      discountAmount = discountResult.discountAmount;
      discountCode = discountResult.discountCode;
    }

    // Calculate payment fee
    const cartTotalInPaise = Math.round(
      (subtotalAfterDiscount + totalGstAmount + shippingCost) * PAISE_PER_RUPEE,
    );
    const paymentFeeResult = await this.calculationService.calculatePaymentFee(
      metadata.paymentMethod,
      cartTotalInPaise,
      "INR",
      metadata.paymentFee,
      metadata.paymentFeeBreakdown,
    );
    const paymentFee = paymentFeeResult.fee;
    const paymentMethod = metadata.paymentMethod;
    const paymentFeeBreakdown =
      paymentFeeResult.breakdown as PaymentFeeBreakdownDto | null;

    // Calculate final total
    const total = this.calculationService.calculateFinalTotal(
      subtotalAfterDiscount,
      totalGstAmount,
      shippingCost,
      paymentFee,
    );

    // Create order atomically using payment-scoped idempotency
    let orderId: string;
    let orderNumber: string;
    try {
      // Persist order
      const persistedOrder = await this.persistenceService.persistOrder(
        customerId,
        {
          subtotal: finalSubtotal, // Use effective subtotal from pricing snapshot
          gstAmount: totalGstAmount,
          discountCode,
          discountAmount,
          shippingCost,
          paymentFee, // Payment fee in paise
          paymentMethod: paymentMethod || null, // Selected payment method
          paymentFeeBreakdown, // Payment fee breakdown
          total,
          shippingAddressId: metadata.shippingAddressId,
          billingAddressId: metadata.billingAddressId,
          razorpayOrderId: paymentIntentId,
          discountSnapshot: metadata.discountSnapshot, // Store full snapshot for refunds/historical accuracy
          pricingSnapshot: metadata.pricingSnapshot, // Store pricing snapshot for refunds/historical accuracy
        },
      );
      orderId = persistedOrder.id;
      orderNumber = persistedOrder.orderNumber;

      // Perform fraud detection check
      const fraudResult = await this.fraudDetectionService.performFraudCheck(
        orderId,
        customerId,
        metadata.email || "",
        metadata.phone || "",
        metadata.shippingAddressId,
        metadata.billingAddressId,
        total,
        paymentMethod || "razorpay",
      );

      // Log fraud check result
      if (fraudResult.flagged) {
        this.logger.warn(
          createLogContext(
            this.contextService,
            "finalizeOrderFromPayment.fraudCheck",
            {
              orderId,
              orderNumber,
              riskScore: fraudResult.riskScore.score,
              riskLevel: fraudResult.riskScore.riskLevel,
            },
          ),
          fraudResult.message,
        );
      }

      // Fetch order items for response
      const _insertedOrderItems = await this.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      // Log snapshot usage for order creation
      if (metadata.discountSnapshot) {
        await this.discountService.logDiscountSnapshotUsage(
          checkoutSessionId,
          orderId,
          metadata.discountSnapshot,
        );
      }

      // Log pricing snapshot usage and detect drift
      if (metadata.pricingSnapshot) {
        await this.snapshotAuditService.logPricingSnapshotUsage(
          checkoutSessionId,
          orderId,
          metadata.pricingSnapshot,
        );

        // Detect pricing drift
        await this.pricingDriftService.detectPricingDrift(
          checkoutSessionId,
          orderId,
          customerId,
          metadata.pricingSnapshot,
        );
      }

      // Atomically create payment-scoped idempotency mapping
      const mappingResult = await this.idempotencyService.createOrderMapping(
        provider,
        paymentIntentId,
        orderId,
        checkoutSessionId,
      );

      // If concurrent creation detected, return existing order
      if (mappingResult.isConcurrent) {
        return this.finalizeOrderFromPayment(
          checkoutSessionId,
          paymentIntentId,
          provider,
        );
      }
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "finalizeOrderFromPayment",
          error,
          { paymentIntentId, checkoutSessionId, provider },
        ),
        "Failed to create order",
      );
      throw error;
    }

    // Transition to ORDER_CREATED state
    try {
      await this.stateTransitionService.transitionToOrderCreated(
        checkoutSessionId,
        orderId,
        CheckoutState.PAYMENT_CONFIRMED,
      );
    } catch (error) {
      // Continue - order is created, state transition failure is non-critical
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToOrderCreated",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to ORDER_CREATED",
      );
    }

    // Create notification for new order
    await this.notificationService.sendOrderConfirmation(
      orderId,
      orderNumber,
      total,
      customerId,
    );

    // Record discount usage if discount was applied
    await this.discountUsageService.recordDiscountUsage(
      orderId,
      discountCode,
      discountAmount,
      metadata.userId,
    );

    // Earn loyalty points for completed order
    if (this.loyaltyService) {
      try {
        await this.loyaltyService.earnPoints(customerId, total, orderId);
      } catch (error) {
        // Log error but don't fail order creation
        this.logger.error(
          createErrorContext(this.contextService, "earnPoints", error, {
            orderId,
            customerId,
            total,
          }),
          "Failed to earn loyalty points for order",
        );
      }
    }

    // Prepare variant items with pricing snapshots
    const variantItemsWithPricing =
      this.pricingSnapshotService.prepareVariantItemsWithPricingSimple(
        cartItemsWithVariants,
        metadata.pricingSnapshot,
      );

    // Persist order items
    const sellerState = this.validationService.getSellerState();
    await this.persistenceService.persistOrderItems(
      orderId,
      variantItemsWithPricing,
      bundleCartItems,
      sellerState,
      buyerState,
      metadata.pricingSnapshot,
    );

    // Commit inventory atomically (release reservation AND decrement inventory)
    // CRITICAL: This uses atomic Lua script to ensure consistency
    // If this fails, inventory will be out of sync and needs manual reconciliation
    await this.inventoryService.commitOrderInventory(
      cart.id,
      orderId,
      cartItemsWithVariants.map((item) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
      })),
      bundleCartItems,
      true, // Clear checkout lock after successful commit
    );

    // Clear cart - use cartId from session
    await this.cartCleanupService.clearCartAfterOrder(
      session.cartId,
      metadata.userId,
    );

    // Build order response
    const orderResponse = await this.responseBuilderService.buildOrderResponse(
      orderId,
      orderNumber,
      customerId,
      subtotal,
      totalGstAmount,
      shippingCost,
      total,
      paymentFee,
      paymentMethod || null,
      paymentFeeBreakdown,
      metadata.shippingAddressId,
      metadata.billingAddressId,
      discountCode,
      discountAmount,
      paymentIntentId,
    );
    const insertedOrderItemsCount = orderResponse.items.length;

    // Transition to COMPLETED state
    try {
      await this.stateTransitionService.transitionToCompleted(
        checkoutSessionId,
        orderId,
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "transitionToCompleted",
          error,
          { checkoutSessionId, orderId },
        ),
        "Failed to transition to COMPLETED",
      );
    }

    this.logger.info(
      createLogContext(this.contextService, "finalizeOrderFromPayment", {
        orderId,
        paymentIntentId,
        checkoutSessionId,
        provider,
      }),
      "Order finalized",
    );

    // Emit order created event
    await this.eventOrchestrationService.emitOrderCreated({
      orderId,
      orderNumber,
      customerId,
      timestamp: new Date(),
      total,
      itemsCount: insertedOrderItemsCount,
      metadata: {
        paymentIntentId,
        checkoutSessionId,
        provider,
      },
    } as OrderCreatedEventPayload);

    // Emit payment completed event
    await this.eventOrchestrationService.emitOrderPaymentCompleted({
      orderId,
      orderNumber,
      customerId,
      timestamp: new Date(),
      paymentIntentId,
      amount: total,
      paymentMethod: metadata.paymentMethod || "online",
      metadata: {
        provider,
      },
    } as OrderPaymentCompletedEventPayload);

    // Mark abandoned cart as recovered if applicable
    await this.abandonedCartRecoveryService.markAsRecovered(
      session.cartId,
      orderId,
    );

    return orderResponse;
  }
}
