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
import { createErrorContext } from "../../../../common/logging/logging.helper";
import { Trace } from "../../../../common/tracing/trace.decorator";
import type { Database } from "../../../../modules/database/db";
import { CartsService } from "../../../carts/carts.service";
import { DB_TOKEN } from "../../../database/database.module";
import { CheckoutState } from "../../../redis-store/constants/checkout-states";
import { CreateOrderDto } from "../../dto/create-order.dto";
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
    @Inject(DB_TOKEN) private readonly db: Database,
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
    const { bundleItems: bundleCartItems, variantItems: variantCartItems } =
      this.cartProcessingService.separateBundleAndVariantItems(allCartItems);
    const variantItemIds = variantCartItems.map((i) => i.id);
    const cartItemsWithVariants =
      await this.cartProcessingService.fetchCartItemProductData(variantItemIds);

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

    const totals = await this.calculationService.calculateOrderTotals(
      cartItemsWithVariants.map((item) => ({
        price: item.price,
        quantity: item.quantity,
        productGstRate: item.productGstRate,
      })),
      bundleCartItems.map((item) => ({
        price: item.price,
        quantity: item.quantity,
        productVariantId: item.productVariantId,
      })),
      sellerState,
      buyerState,
    );
    const { subtotal, totalGstAmount } = totals;
    const shippingCost = metadata.shippingCost;

    // Use discount snapshot from checkout metadata
    let discountAmount = 0;
    let discountCode: string | null = null;
    if (metadata.discountSnapshot) {
      // Validate snapshot and extract discount amount/code
      const snapshotTotal =
        metadata.discountSnapshot.total + totalGstAmount + shippingCost;
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
    const paymentFee = metadata.paymentFee || 0;
    const paymentMethod = metadata.paymentMethod;
    const paymentFeeBreakdown = metadata.paymentFeeBreakdown || null;

    // Calculate final total
    const total = this.calculationService.calculateFinalTotal(
      subtotalAfterDiscount,
      totalGstAmount,
      shippingCost,
      paymentFee,
    );

    // Persist order
    let orderId: string;
    const persistedOrderResult = await this.persistenceService.persistOrder(
      customerId,
      {
        subtotal: finalSubtotal,
        gstAmount: totalGstAmount,
        discountCode,
        discountAmount,
        shippingCost,
        paymentFee,
        paymentMethod: paymentMethod || null,
        paymentFeeBreakdown,
        total,
        shippingAddressId: metadata.shippingAddressId,
        billingAddressId: metadata.billingAddressId,
        razorpayOrderId: null, // COD orders don't have Razorpay order ID
        discountSnapshot: metadata.discountSnapshot,
        pricingSnapshot: metadata.pricingSnapshot,
      },
    );
    orderId = persistedOrderResult.id;
    const orderNumber = persistedOrderResult.orderNumber;

    // Log snapshot usage
    await this.snapshotAuditService.logSnapshotUsage(
      checkoutSessionId,
      orderId,
      metadata.pricingSnapshot,
      metadata.discountSnapshot,
    );

    // Prepare variant items with pricing snapshots
    const variantItemsWithPricing =
      this.pricingSnapshotService.prepareVariantItemsWithPricing(
        cartItemsWithVariants,
        metadata.pricingSnapshot,
      );

    // Persist order items
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
      false, // Don't clear checkout lock for COD orders
    );

    // Create COD payment record
    await this.persistenceService.createCodPayment(orderId, total);

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
      ...order,
      gstBreakdown,
      items: orderItemsList,
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
      discountCode: order.discountCode ?? undefined,
      discountAmount: order.discountAmount ?? undefined,
    };
  }
}
