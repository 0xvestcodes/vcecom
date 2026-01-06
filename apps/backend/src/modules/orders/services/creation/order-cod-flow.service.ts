import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { addresses, eq, orderItems, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import {
  COD_PAYMENT_METHOD,
  isCodPayment,
} from "../../../../common/constants/orders.constants";
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
import { FraudDetectionService } from "../../../fraud-detection/fraud-detection.service";
import { CheckoutState } from "../../../redis-store/constants/checkout-states";
import { LoyaltyService } from "../../../wallet/services/loyalty.service";
import { CreateOrderDto } from "../../dto/create-order.dto";
import type { PricingSnapshotDto } from "../../dto/enriched-order-item.dto";
import { OrderResponseDto } from "../../dto/order-response.dto";
import { OrderCalculationService } from "../calculation/order-calculation.service";
import { OrderCartCleanupService } from "../cart/order-cart-cleanup.service";
import { OrderCartProcessingService } from "../cart/order-cart-processing.service";
import { OrderCheckoutSessionService } from "../checkout/order-checkout-session.service";
import { OrderStateTransitionService } from "../checkout/order-state-transition.service";
import { OrderDiscountService } from "../discount/order-discount.service";
import { OrderInventoryService } from "../inventory/order-inventory.service";
import { OrderNotificationService } from "../notifications/order-notification.service";
import { OrderPersistenceService } from "../persistence/order-persistence.service";
import { OrderPricingSnapshotService } from "../snapshot/order-pricing-snapshot.service";
import { OrderSnapshotAuditService } from "../snapshot/order-snapshot-audit.service";
import { OrderSnapshotValidationService } from "../snapshot/order-snapshot-validation.service";
import { OrderValidationService } from "../validation/order-validation.service";

/**
 * Service responsible for COD (Cash on Delivery) order creation flow
 */
@Injectable()
export class OrderCodFlowService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    private readonly cartsService: CartsService,
    private readonly abandonedCartRecoveryService: AbandonedCartRecoveryService,
    private readonly checkoutSessionService: OrderCheckoutSessionService,
    private readonly cartProcessingService: OrderCartProcessingService,
    private readonly validationService: OrderValidationService,
    private readonly calculationService: OrderCalculationService,
    private readonly snapshotValidationService: OrderSnapshotValidationService,
    private readonly persistenceService: OrderPersistenceService,
    private readonly snapshotAuditService: OrderSnapshotAuditService,
    private readonly pricingSnapshotService: OrderPricingSnapshotService,
    private readonly inventoryService: OrderInventoryService,
    private readonly stateTransitionService: OrderStateTransitionService,
    private readonly cartCleanupService: OrderCartCleanupService,
    private readonly notificationService: OrderNotificationService,
    private readonly discountService: OrderDiscountService,
    private readonly fraudDetectionService: FraudDetectionService,
    @Inject(DB_TOKEN) private readonly db: Database,
    private readonly loyaltyService?: LoyaltyService,
  ) {}

  /**
   * Create order directly for COD (Cash on Delivery) orders
   * COD orders skip payment intent creation and go straight to order creation
   */
  @Trace({ operation: "OrderCodFlowService.createCodOrder" })
  async createCodOrder(
    checkoutSessionId: string,
    userId: string | null,
    createOrderDto: CreateOrderDto,
    sessionId: string | null,
  ): Promise<OrderResponseDto> {
    // Get checkout session and validate state
    const session = await this.checkoutSessionService.getSession(
      checkoutSessionId,
      CheckoutState.LOCKED,
    );

    // Get checkout metadata
    const metadata =
      await this.checkoutSessionService.getMetadata(checkoutSessionId);

    // Validate metadata exists and has required fields
    if (!metadata) {
      throw new BadRequestException(
        "Checkout metadata not found for COD order creation",
      );
    }

    // Verify payment method is COD (use helper function for consistency)
    if (!isCodPayment(metadata.paymentMethod)) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "createCodOrder",
          new Error("Invalid payment method for COD order"),
          {
            checkoutSessionId,
            paymentMethod: metadata.paymentMethod,
            expectedCOD: COD_PAYMENT_METHOD,
          },
        ),
        "Payment method validation failed for COD order",
      );
      throw new BadRequestException(
        `Expected COD payment method, got ${metadata.paymentMethod || "undefined"}`,
      );
    }

    // Use customerId from metadata (required field)
    const customerId = metadata.customerId;

    // Get cart data - use cartId from session
    const cart = await this.cartsService.getCartById(session.cartId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty or not found");
    }

    // Extract and process cart items
    const cartItemIds = cart.items.map((item) => item.id);
    const allCartItems =
      await this.cartProcessingService.extractCartItems(cartItemIds);

    if (
      !allCartItems ||
      !Array.isArray(allCartItems) ||
      allCartItems.length === 0
    ) {
      throw new BadRequestException("No cart items found after extraction");
    }

    let bundleCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }> = [];
    let variantCartItems: Array<{
      id: string;
      productVariantId: string;
      quantity: number;
      price: number;
      metadata: unknown;
    }> = [];

    try {
      // Log allCartItems before separation for debugging
      this.logger.debug(
        createLogContext(this.contextService, "beforeSeparation", {
          checkoutSessionId,
          allCartItemsCount: allCartItems.length,
          allCartItemsSample: allCartItems.slice(0, 2).map((item) => ({
            id: item.id,
            productVariantId: item.productVariantId,
            hasMetadata: !!item.metadata,
            metadataType:
              item.metadata &&
              typeof item.metadata === "object" &&
              "type" in item.metadata
                ? (item.metadata as { type?: string }).type
                : "no-type",
          })),
        }),
        "Cart items before separation",
      );

      const separationResult =
        this.cartProcessingService.separateBundleAndVariantItems(allCartItems);

      if (!separationResult || typeof separationResult !== "object") {
        throw new Error("Separation result is invalid");
      }

      bundleCartItems = Array.isArray(separationResult.bundleItems)
        ? separationResult.bundleItems
        : [];
      variantCartItems = Array.isArray(separationResult.variantItems)
        ? separationResult.variantItems
        : [];

      // Log separation results
      this.logger.debug(
        createLogContext(this.contextService, "afterSeparation", {
          checkoutSessionId,
          bundleItemsCount: bundleCartItems.length,
          variantItemsCount: variantCartItems.length,
          bundleItemIds: bundleCartItems.map((i) => i.id),
          variantItemIds: variantCartItems.map((i) => i.id),
        }),
        "Cart items after separation",
      );
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "separateBundleAndVariantItems",
          error instanceof Error ? error : new Error(String(error)),
          { checkoutSessionId, allCartItemsCount: allCartItems.length },
        ),
        "Failed to separate cart items, treating all as variant items",
      );
      // Fallback: treat all items as variant items
      variantCartItems = allCartItems;
      bundleCartItems = [];
    }

    // Final validation - ensure we have arrays
    if (!Array.isArray(variantCartItems)) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateVariantCartItems",
          new Error("variantCartItems is not an array"),
          { checkoutSessionId, variantCartItemsType: typeof variantCartItems },
        ),
        "variantCartItems validation failed",
      );
      throw new BadRequestException(
        "Failed to separate cart items into variants and bundles",
      );
    }

    if (!Array.isArray(bundleCartItems)) {
      bundleCartItems = [];
    }

    // Log separation results for debugging
    this.logger.debug(
      createLogContext(this.contextService, "cartItemSeparation", {
        checkoutSessionId,
        totalCartItems: allCartItems.length,
        variantItemsCount: variantCartItems.length,
        bundleItemsCount: bundleCartItems.length,
        variantItemIds: variantCartItems.map((i) => i.id),
      }),
      "Cart items separated into variants and bundles",
    );

    // Check if we have variant items
    if (variantCartItems.length === 0) {
      this.logger.warn(
        createLogContext(this.contextService, "noVariantItems", {
          checkoutSessionId,
          totalCartItems: allCartItems.length,
          bundleItemsCount: bundleCartItems.length,
          allCartItemIds: allCartItems.map((i) => i.id),
          allCartItemsMetadata: allCartItems.map((i) => ({
            id: i.id,
            metadata: i.metadata,
            metadataType:
              i.metadata &&
              typeof i.metadata === "object" &&
              "type" in i.metadata
                ? (i.metadata as { type?: string }).type
                : "no-type-or-not-object",
          })),
        }),
        "No variant items found after separation - treating all items as variants as fallback",
      );

      // If we have cart items but no variants, treat them all as variants
      // This handles cases where metadata is incorrectly set or separation logic misclassifies items
      if (allCartItems.length > 0) {
        this.logger.warn(
          createLogContext(this.contextService, "treatingAllAsVariants", {
            checkoutSessionId,
            totalCartItems: allCartItems.length,
            bundleItemsCount: bundleCartItems.length,
          }),
          "No variant items found - treating all cart items as variants as fallback",
        );
        variantCartItems = allCartItems;
        bundleCartItems = [];
      } else {
        // No items at all - this is a real error
        throw new BadRequestException(
          "Cart is empty - no items found to create order",
        );
      }
    }

    const variantItemIds = variantCartItems.map((i) => i.id);
    const cartItemsWithVariants =
      await this.cartProcessingService.fetchCartItemProductData(variantItemIds);

    if (!cartItemsWithVariants || !Array.isArray(cartItemsWithVariants)) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "fetchCartItemProductData",
          new Error("fetchCartItemProductData returned invalid result"),
          {
            checkoutSessionId,
            variantItemIdsCount: variantItemIds.length,
            variantItemIds,
            resultType: typeof cartItemsWithVariants,
            resultIsArray: Array.isArray(cartItemsWithVariants),
          },
        ),
        "Failed to fetch cart item product data",
      );
      throw new BadRequestException("Failed to fetch cart item product data");
    }

    if (cartItemsWithVariants.length === 0) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "emptyCartItemsWithVariants",
          new Error("fetchCartItemProductData returned empty array"),
          {
            checkoutSessionId,
            variantItemIdsCount: variantItemIds.length,
            variantItemIds,
            variantCartItemsCount: variantCartItems.length,
          },
        ),
        "fetchCartItemProductData returned empty array",
      );
      throw new BadRequestException(
        "No cart items with variants found. This may indicate a data inconsistency.",
      );
    }

    // Get shipping address for GST calculation
    const [shippingAddress] = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.id, metadata.shippingAddressId))
      .limit(1);

    if (!shippingAddress) {
      throw new NotFoundException("Shipping address not found");
    }

    // Calculate totals
    const sellerState = this.validationService.getSellerState();
    const buyerState = shippingAddress.state;

    // Ensure bundleCartItems is defined and is an array
    const safeBundleCartItems =
      bundleCartItems && Array.isArray(bundleCartItems) ? bundleCartItems : [];

    const totals = await this.calculationService.calculateOrderTotals(
      cartItemsWithVariants.map((item) => ({
        price: item.price,
        quantity: item.quantity,
        productGstRate: item.productGstRate,
        productVariantId: item.productVariantId,
      })),
      safeBundleCartItems.map((item) => ({
        price: item.price,
        quantity: item.quantity,
        productVariantId: item.productVariantId,
      })),
      sellerState,
      buyerState,
      userId, // Pass customer ID for tax engine
    );
    const { subtotal, totalGstAmount } = totals;
    const shippingCost = metadata.shippingCost || 0;

    // Use discount snapshot from checkout metadata
    let discountAmount = 0;
    let discountCode: string | null = null;
    if (metadata.discountSnapshot) {
      // Validate snapshot and extract discount amount/code
      const discountSnapshotTotal = metadata.discountSnapshot.total ?? 0;
      const snapshotTotal =
        discountSnapshotTotal + totalGstAmount + shippingCost;
      const validationResult =
        await this.discountService.validateDiscountSnapshot(
          checkoutSessionId,
          metadata.discountSnapshot,
          snapshotTotal,
        );
      discountAmount = validationResult.discountAmount;
      discountCode = validationResult.discountCode;
    }

    // Validate pricing snapshot and get effective subtotal
    // Ensure pricingSnapshot exists before validation
    if (!metadata.pricingSnapshot) {
      throw new BadRequestException(
        "Pricing snapshot is required for COD order creation",
      );
    }
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

    // Get payment fee from metadata (already calculated)
    // Ensure paymentFee is a valid number (in paise)
    const rawPaymentFee = metadata.paymentFee;
    const paymentFee =
      typeof rawPaymentFee === "number" &&
      !Number.isNaN(rawPaymentFee) &&
      rawPaymentFee >= 0
        ? rawPaymentFee
        : 0;
    const paymentMethod = metadata.paymentMethod;
    const paymentFeeBreakdown = metadata.paymentFeeBreakdown || null;

    // Ensure all numeric values are valid numbers
    const safeFinalSubtotal =
      typeof finalSubtotal === "number" && !Number.isNaN(finalSubtotal)
        ? finalSubtotal
        : 0;
    const safeTotalGstAmount =
      typeof totalGstAmount === "number" && !Number.isNaN(totalGstAmount)
        ? totalGstAmount
        : 0;
    const safeDiscountAmount =
      typeof discountAmount === "number" && !Number.isNaN(discountAmount)
        ? discountAmount
        : 0;
    const safeShippingCost =
      typeof shippingCost === "number" && !Number.isNaN(shippingCost)
        ? shippingCost
        : 0;
    const safeSubtotalAfterDiscount =
      typeof subtotalAfterDiscount === "number" &&
      !Number.isNaN(subtotalAfterDiscount)
        ? subtotalAfterDiscount
        : safeFinalSubtotal;

    // Calculate final total
    const total = this.calculationService.calculateFinalTotal(
      safeSubtotalAfterDiscount,
      safeTotalGstAmount,
      safeShippingCost,
      paymentFee,
    );

    // Ensure total is a valid number
    const safeTotal =
      typeof total === "number" && !Number.isNaN(total) && total >= 0
        ? total
        : safeFinalSubtotal +
          safeTotalGstAmount +
          safeShippingCost +
          paymentFee / 100;

    // Persist order
    let orderId: string;
    const persistedOrderResult = await this.persistenceService.persistOrder(
      customerId,
      {
        subtotal: safeFinalSubtotal,
        gstAmount: safeTotalGstAmount,
        discountCode,
        discountAmount: safeDiscountAmount,
        shippingCost: safeShippingCost,
        paymentFee,
        paymentMethod: paymentMethod || null,
        paymentFeeBreakdown,
        total: safeTotal,
        shippingAddressId: metadata.shippingAddressId,
        billingAddressId: metadata.billingAddressId,
        razorpayOrderId: null, // COD orders don't have Razorpay order ID
        discountSnapshot: metadata.discountSnapshot,
        pricingSnapshot: metadata.pricingSnapshot,
      },
    );
    orderId = persistedOrderResult.id;
    const orderNumber = persistedOrderResult.orderNumber;

    // Perform fraud detection check
    const fraudResult = await this.fraudDetectionService.performFraudCheck(
      orderId,
      customerId,
      metadata.email || "",
      metadata.phone || "",
      metadata.shippingAddressId,
      metadata.billingAddressId,
      safeTotal,
      COD_PAYMENT_METHOD,
    );

    // Log fraud check result
    if (fraudResult.flagged) {
      this.logger.warn(
        createLogContext(this.contextService, "createCodOrder.fraudCheck", {
          orderId,
          orderNumber,
          riskScore: fraudResult.riskScore.score,
          riskLevel: fraudResult.riskScore.riskLevel,
        }),
        fraudResult.message,
      );
    }

    // Log snapshot usage
    await this.snapshotAuditService.logSnapshotUsage(
      checkoutSessionId,
      orderId,
      metadata.pricingSnapshot,
      metadata.discountSnapshot,
    );

    // Prepare variant items with pricing snapshots
    // Ensure cartItemsWithVariants is valid before calling prepareVariantItemsWithPricing
    if (!cartItemsWithVariants || !Array.isArray(cartItemsWithVariants)) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateCartItemsWithVariants",
          new Error("cartItemsWithVariants is not an array"),
          {
            checkoutSessionId,
            cartItemsWithVariantsType: typeof cartItemsWithVariants,
            variantCartItemsCount: variantCartItems.length,
            variantItemIdsCount: variantItemIds.length,
          },
        ),
        "cartItemsWithVariants validation failed",
      );
      throw new BadRequestException(
        "Cart items with variants are required for order creation",
      );
    }

    if (cartItemsWithVariants.length === 0) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "emptyCartItemsWithVariants",
          new Error("cartItemsWithVariants is empty"),
          {
            checkoutSessionId,
            variantCartItemsCount: variantCartItems.length,
            variantItemIdsCount: variantItemIds.length,
            variantItemIds,
            allCartItemsCount: allCartItems.length,
          },
        ),
        "cartItemsWithVariants is empty - this should have been caught earlier",
      );
      throw new BadRequestException("Cart items with variants array is empty");
    }

    let variantItemsWithPricing: Array<{
      productVariantId: string;
      quantity: number;
      price: number;
      productGstRate: number;
      pricingSnapshot?: PricingSnapshotDto;
    }> = [];

    try {
      const result = this.pricingSnapshotService.prepareVariantItemsWithPricing(
        cartItemsWithVariants,
        metadata.pricingSnapshot,
      );

      // Validate result immediately
      if (!result || !Array.isArray(result)) {
        throw new Error(
          `prepareVariantItemsWithPricing returned invalid result: ${typeof result}`,
        );
      }

      variantItemsWithPricing = result;
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "prepareVariantItemsWithPricing",
          error instanceof Error ? error : new Error(String(error)),
          {
            checkoutSessionId,
            cartItemsWithVariantsCount: cartItemsWithVariants.length,
            cartItemsWithVariantsSample: cartItemsWithVariants.slice(0, 1),
            hasPricingSnapshot: !!metadata.pricingSnapshot,
            pricingSnapshotKeys: metadata.pricingSnapshot
              ? Object.keys(metadata.pricingSnapshot)
              : [],
          },
        ),
        "Failed to prepare variant items with pricing, using cart items as fallback",
      );

      // Fallback: create variant items from cart items without pricing snapshot
      try {
        variantItemsWithPricing = cartItemsWithVariants.map((item) => {
          if (!item || typeof item !== "object") {
            throw new Error(
              `Invalid cart item in fallback: ${JSON.stringify(item)}`,
            );
          }
          return {
            productVariantId: item.productVariantId || "",
            quantity:
              typeof item.quantity === "number" && item.quantity > 0
                ? item.quantity
                : 1,
            price:
              typeof item.price === "number" && item.price >= 0
                ? item.price
                : 0,
            productGstRate:
              typeof item.productGstRate === "number" &&
              item.productGstRate >= 0
                ? item.productGstRate
                : 0,
          };
        });
      } catch (fallbackError) {
        this.logger.error(
          createErrorContext(
            this.contextService,
            "fallbackVariantItems",
            fallbackError instanceof Error
              ? fallbackError
              : new Error(String(fallbackError)),
            { checkoutSessionId },
          ),
          "Fallback variant items creation also failed",
        );
        throw new BadRequestException(
          `Failed to prepare variant items: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        );
      }
    }

    // Final validation - ensure variantItemsWithPricing is valid
    if (!variantItemsWithPricing || !Array.isArray(variantItemsWithPricing)) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "validateVariantItemsWithPricing",
          new Error(
            "variantItemsWithPricing is not an array after all attempts",
          ),
          {
            checkoutSessionId,
            variantItemsWithPricingType: typeof variantItemsWithPricing,
            variantItemsWithPricingValue: variantItemsWithPricing,
            cartItemsWithVariantsCount: cartItemsWithVariants.length,
          },
        ),
        "variantItemsWithPricing validation failed",
      );
      throw new BadRequestException(
        "Failed to prepare variant items with pricing",
      );
    }

    if (variantItemsWithPricing.length === 0) {
      this.logger.warn(
        createLogContext(this.contextService, "emptyVariantItems", {
          checkoutSessionId,
          cartItemsWithVariantsCount: cartItemsWithVariants.length,
        }),
        "variantItemsWithPricing is empty after preparation",
      );
      throw new BadRequestException(
        "No variant items prepared for order creation",
      );
    }

    // Persist order items
    await this.persistenceService.persistOrderItems(
      orderId,
      variantItemsWithPricing,
      safeBundleCartItems,
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
      safeBundleCartItems,
      false, // Don't clear checkout lock for COD orders
    );

    // Create COD payment record
    // Ensure total is a valid number
    const safeTotalForPayment =
      typeof total === "number" && !Number.isNaN(total) && total >= 0
        ? total
        : safeTotal;
    await this.persistenceService.createCodPayment(
      orderId,
      safeTotalForPayment,
    );

    // COD orders: Transition through valid states
    // LOCKED → PAYMENT_CONFIRMED → ORDER_CREATED → COMPLETED
    // COD selection is equivalent to payment confirmation (commitment to pay on delivery)
    await this.stateTransitionService.completeCodOrderTransitions(
      checkoutSessionId,
      orderId,
    );

    // Clear cart
    await this.cartCleanupService.clearCartById(session.cartId);

    // Get order items for response
    const orderItemsList = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Calculate GST breakdown
    const gstBreakdown = {
      cgst: totals.totalCgst,
      sgst: totals.totalSgst,
      igst: totals.totalIgst,
      totalGst: totalGstAmount,
      isIntraState: sellerState === buyerState,
    };

    // Send order confirmation notification
    await this.notificationService.sendOrderConfirmation(
      orderId,
      orderNumber,
      total,
      customerId,
      COD_PAYMENT_METHOD,
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
          "Failed to earn loyalty points for COD order",
        );
      }
    }

    // Mark abandoned cart as recovered if applicable
    await this.abandonedCartRecoveryService.markAsRecovered(
      session.cartId,
      orderId,
    );

    // Fetch order for response
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return {
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: order.subtotal,
      gstAmount: order.gstAmount,
      gstBreakdown,
      shippingCost: order.shippingCost,
      paymentFee: order.paymentFee ?? undefined,
      paymentMethod: order.paymentMethod ?? null,
      paymentFeeBreakdown:
        (order.paymentFeeBreakdown as {
          method: string;
          chargeType: string;
          calculatedFee: number;
          flatAmount?: number;
          percentage?: number;
          mixMin?: number;
          mixCap?: number;
        } | null) || null,
      total: order.total,
      razorpayOrderId: order.razorpayOrderId ?? null,
      shippingProvider: order.shippingProvider ?? null,
      shippingAddressId: order.shippingAddressId,
      billingAddressId: order.billingAddressId,
      items: orderItemsList,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      archived: order.archived ?? false,
      archivedAt: order.archivedAt ?? null,
      archivedBy: order.archivedBy ?? null,
      discountCode: order.discountCode ?? undefined,
      discountAmount: order.discountAmount ?? undefined,
    };
  }
}
